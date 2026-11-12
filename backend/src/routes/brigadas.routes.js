import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION, notFound } from '../lib/errors.js';
import { PERMISOS } from '../lib/roles.js';
import { uuidSchema, validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-06: brigadas de cada sede. Criterios: un brigadista puede pertenecer a una
// o más brigadas, y cada brigada tiene un líder (que también es miembro).

export const TIPOS_BRIGADA = ['primeros_auxilios', 'evacuacion', 'contra_incendios'];

const ETIQUETA_TIPO = {
  primeros_auxilios: 'primeros auxilios',
  evacuacion: 'evacuación',
  contra_incendios: 'contra incendios',
};

const integrantesSchema = {
  liderId: z.uuid('Elige quién lidera la brigada.'),
  miembrosIds: z
    .array(z.uuid('Hay un brigadista no válido en la lista.'), 'Elige al menos un brigadista.')
    .min(1, 'Elige al menos un brigadista.')
    .max(50, 'Una brigada admite máximo 50 brigadistas.')
    .transform((ids) => [...new Set(ids)]),
};

const liderEsMiembro = [
  (datos) => datos.miembrosIds.includes(datos.liderId),
  { message: 'El líder debe ser parte de la brigada.', path: ['liderId'] },
];

const crearSchema = z
  .object({
    sedeId: z.uuid('Elige la sede de la brigada.'),
    tipo: z.enum(TIPOS_BRIGADA, 'Elige el tipo de brigada.'),
    ...integrantesSchema,
  })
  .refine(...liderEsMiembro);

const editarSchema = z.object(integrantesSchema).refine(...liderEsMiembro);

const SELECT_BRIGADAS = `
  SELECT b.id_brigada, b.tipo, b.creado_en, b.actualizado_en,
         s.id_sede, s.nombre AS sede_nombre,
         l.id_usuario AS lider_id, l.nombre AS lider_nombre, l.correo AS lider_correo,
         l.rol AS lider_rol, l.activo AS lider_activo,
         COALESCE(
           json_agg(
             json_build_object(
               'id', u.id_usuario,
               'nombre', u.nombre,
               'correo', u.correo,
               'rol', u.rol,
               'activo', u.activo,
               'estado', CASE WHEN u.activo THEN 'activo' ELSE 'inactivo' END,
               'esLider', u.id_usuario = b.id_lider,
               'fechaIngreso', bu.fecha_ingreso
             )
             ORDER BY u.id_usuario = b.id_lider DESC, lower(u.nombre)
           ) FILTER (WHERE u.id_usuario IS NOT NULL),
           '[]'
         ) AS miembros
    FROM brigada b
    JOIN sede s ON s.id_sede = b.id_sede
    JOIN usuario l ON l.id_usuario = b.id_lider
    LEFT JOIN brigada_usuario bu ON bu.id_brigada = b.id_brigada
    LEFT JOIN usuario u ON u.id_usuario = bu.id_usuario`;

const GROUP_BY = 'GROUP BY b.id_brigada, s.id_sede, l.id_usuario';

function toBrigadaDto(row) {
  return {
    id: row.id_brigada,
    tipo: row.tipo,
    sedeId: row.id_sede,
    sede: { id: row.id_sede, nombre: row.sede_nombre },
    lider: {
      id: row.lider_id,
      nombre: row.lider_nombre,
      correo: row.lider_correo,
      rol: row.lider_rol,
      activo: row.lider_activo,
    },
    miembros: row.miembros,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

// Solo encuentra brigadas de sedes de la empresa de quien hace la petición.
async function findBrigada(db, empresaId, idBrigada) {
  if (!uuidSchema.safeParse(idBrigada).success) throw notFound('No encontramos esa brigada.');
  const { rows } = await db.query(
    `${SELECT_BRIGADAS} WHERE s.id_empresa = $1 AND b.id_brigada = $2 ${GROUP_BY}`,
    [empresaId, idBrigada]
  );
  if (!rows[0]) throw notFound('No encontramos esa brigada.');
  return rows[0];
}

// Solo se asignan brigadistas activos de la empresa. Quien ya era miembro puede
// seguir aunque haya cambiado de rol o esté inactivo, para no perder el historial;
// el líder, en cambio, siempre debe ser un brigadista activo.
async function validarIntegrantes(db, empresaId, { liderId, miembrosIds }, actualesIds = []) {
  const { rows } = await db.query(
    `SELECT id_usuario, nombre, rol, activo, contrasena_hash IS NULL AS pendiente
       FROM usuario
      WHERE id_empresa = $1 AND id_usuario = ANY($2::uuid[])`,
    [empresaId, miembrosIds]
  );
  if (rows.length !== miembrosIds.length) {
    const mensaje = 'Algunas de las personas elegidas no pertenecen a tu empresa.';
    throw new AppError(400, 'DATOS_INVALIDOS', mensaje, { miembrosIds: mensaje });
  }

  const habilitado = (u) => u.rol === 'brigadista' && u.activo && !u.pendiente;
  const actuales = new Set(actualesIds);
  const noValidos = rows.filter((u) => !actuales.has(u.id_usuario) && !habilitado(u));
  if (noValidos.length) {
    const nombres = noValidos.map((u) => u.nombre).join(', ');
    const mensaje = `Solo puedes asignar brigadistas activos. Revisa: ${nombres}.`;
    throw new AppError(400, 'DATOS_INVALIDOS', mensaje, { miembrosIds: mensaje });
  }

  const lider = rows.find((u) => u.id_usuario === liderId);
  if (!habilitado(lider)) {
    const mensaje = `${lider.nombre} no puede liderar la brigada: el líder debe ser un brigadista activo.`;
    throw new AppError(400, 'DATOS_INVALIDOS', mensaje, { liderId: mensaje });
  }
}

const router = Router();
router.use(authenticate, requirePermission(PERMISOS.BRIGADAS_VER));

// Todas las brigadas de la empresa, o las de una sede con ?sede=<id>.
router.get('/', async (req, res) => {
  const { empresaId } = req.auth.usuario;
  const params = [empresaId];
  let filtro = '';
  if (req.query.sede) {
    const sede = await findSede(pool, empresaId, String(req.query.sede));
    params.push(sede.id_sede);
    filtro = 'AND s.id_sede = $2';
  }

  const { rows } = await pool.query(
    `${SELECT_BRIGADAS} WHERE s.id_empresa = $1 ${filtro} ${GROUP_BY} ORDER BY lower(s.nombre), b.tipo`,
    params
  );
  res.json({ brigadas: rows.map(toBrigadaDto) });
});

router.get('/:id', async (req, res) => {
  const row = await findBrigada(pool, req.auth.usuario.empresaId, req.params.id);
  res.json({ brigada: toBrigadaDto(row) });
});

router.post(
  '/',
  requirePermission(PERMISOS.BRIGADAS_GESTIONAR),
  validateBody(crearSchema),
  async (req, res) => {
    const { empresaId } = req.auth.usuario;
    const { sedeId, tipo, liderId, miembrosIds } = req.body;
    const sede = await findSede(pool, empresaId, sedeId);
    await validarIntegrantes(pool, empresaId, { liderId, miembrosIds });

    let idBrigada;
    try {
      idBrigada = await withTransaction(async (db) => {
        const {
          rows: [brigada],
        } = await db.query(
          'INSERT INTO brigada (id_sede, tipo, id_lider) VALUES ($1, $2, $3) RETURNING id_brigada',
          [sede.id_sede, tipo, liderId]
        );
        await db.query(
          `INSERT INTO brigada_usuario (id_brigada, id_usuario)
           SELECT $1, unnest($2::uuid[])`,
          [brigada.id_brigada, miembrosIds]
        );
        return brigada.id_brigada;
      });
    } catch (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new AppError(
          409,
          'BRIGADA_EXISTENTE',
          `${sede.nombre} ya tiene una brigada de ${ETIQUETA_TIPO[tipo]}. Edítala en lugar de crear otra.`
        );
      }
      throw error;
    }

    const row = await findBrigada(pool, empresaId, idBrigada);
    res.status(201).json({ brigada: toBrigadaDto(row) });
  }
);

// Cambiar el líder y los miembros. Quien sigue en la brigada conserva su fecha de ingreso.
router.put(
  '/:id',
  requirePermission(PERMISOS.BRIGADAS_GESTIONAR),
  validateBody(editarSchema),
  async (req, res) => {
    const { empresaId } = req.auth.usuario;
    const { liderId, miembrosIds } = req.body;
    const actual = await findBrigada(pool, empresaId, req.params.id);
    await validarIntegrantes(
      pool,
      empresaId,
      { liderId, miembrosIds },
      actual.miembros.map((m) => m.id)
    );

    await withTransaction(async (db) => {
      await db.query(
        'UPDATE brigada SET id_lider = $2, actualizado_en = now() WHERE id_brigada = $1',
        [actual.id_brigada, liderId]
      );
      await db.query(
        'DELETE FROM brigada_usuario WHERE id_brigada = $1 AND NOT (id_usuario = ANY($2::uuid[]))',
        [actual.id_brigada, miembrosIds]
      );
      await db.query(
        `INSERT INTO brigada_usuario (id_brigada, id_usuario)
         SELECT $1, unnest($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [actual.id_brigada, miembrosIds]
      );
    });

    const row = await findBrigada(pool, empresaId, actual.id_brigada);
    res.json({ brigada: toBrigadaDto(row) });
  }
);

router.delete('/:id', requirePermission(PERMISOS.BRIGADAS_GESTIONAR), async (req, res) => {
  const brigada = await findBrigada(pool, req.auth.usuario.empresaId, req.params.id);
  await pool.query('DELETE FROM brigada WHERE id_brigada = $1', [brigada.id_brigada]);
  res.status(204).end();
});

export default router;
