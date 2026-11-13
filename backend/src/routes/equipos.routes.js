import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { notFound } from '../lib/errors.js';
import { PERMISOS } from '../lib/roles.js';
import { uuidSchema, validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-11: inventario de equipos de cada sede con su fecha de vencimiento o recarga.
// Criterios: cada equipo queda asociado a una sede, y los próximos a vencer se
// resaltan (el frontend los marca a 30 días o menos, como el diagrama de estados).

const TIPOS = ['extintor', 'botiquin', 'camilla', 'otro'];
const ESTADOS = ['operativo', 'mantenimiento', 'vencido', 'baja'];

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Usa una fecha válida.');

const camposEquipo = {
  tipo: z.enum(TIPOS, 'Elige el tipo de equipo.'),
  nombre: z.string('Escribe el nombre o código del equipo.').trim().min(2, 'Escribe el nombre o código del equipo.').max(120, 'Máximo 120 caracteres.'),
  ubicacion: z.string('Indica dónde está el equipo.').trim().min(2, 'Indica dónde está el equipo.').max(200, 'Máximo 200 caracteres.'),
  // Vacío o null: el equipo no vence (p. ej. una camilla).
  fechaVencimiento: z.union([fecha, z.literal(''), z.null()]).transform((v) => v || null),
  estado: z.enum(ESTADOS, 'Elige un estado válido.'),
  notas: z.string().trim().max(500, 'Las notas admiten máximo 500 caracteres.'),
};

const crearSchema = z.object({
  ...camposEquipo,
  fechaVencimiento: camposEquipo.fechaVencimiento.optional().default(null),
  estado: camposEquipo.estado.default('operativo'),
  notas: camposEquipo.notas.default(''),
});

const editarSchema = z.object(camposEquipo).partial();

function toEquipoDto(e) {
  return {
    id: e.id_equipo,
    sedeId: e.id_sede,
    tipo: e.tipo,
    nombre: e.nombre,
    ubicacion: e.ubicacion,
    fechaVencimiento: e.fecha_vencimiento,
    estado: e.estado,
    notas: e.notas,
    creadoEn: e.creado_en,
    actualizadoEn: e.actualizado_en,
  };
}

// Solo encuentra equipos de sedes de la empresa de quien hace la petición.
async function findEquipo(empresaId, idEquipo) {
  if (!uuidSchema.safeParse(idEquipo).success) throw notFound('No encontramos ese equipo.');
  const { rows } = await pool.query(
    `SELECT e.* FROM equipo e JOIN sede s ON s.id_sede = e.id_sede
      WHERE e.id_equipo = $1 AND s.id_empresa = $2`,
    [idEquipo, empresaId]
  );
  if (!rows[0]) throw notFound('No encontramos ese equipo.');
  return rows[0];
}

const router = Router();
router.use(authenticate);

router.get('/sedes/:idSede/equipos', requirePermission(PERMISOS.EQUIPOS_VER), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { rows } = await pool.query(
    `SELECT * FROM equipo WHERE id_sede = $1
      ORDER BY fecha_vencimiento ASC NULLS LAST, lower(nombre)`,
    [sede.id_sede]
  );
  res.json({ equipos: rows.map(toEquipoDto) });
});

router.post(
  '/sedes/:idSede/equipos',
  requirePermission(PERMISOS.EQUIPOS_GESTIONAR),
  validateBody(crearSchema),
  async (req, res) => {
    const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
    const { tipo, nombre, ubicacion, fechaVencimiento, estado, notas } = req.body;
    const {
      rows: [e],
    } = await pool.query(
      `INSERT INTO equipo (id_sede, tipo, nombre, ubicacion, fecha_vencimiento, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sede.id_sede, tipo, nombre, ubicacion, fechaVencimiento, estado, notas]
    );
    res.status(201).json({ equipo: toEquipoDto(e) });
  }
);

// Solo cambia los campos enviados. `fechaVencimiento: null` deja el equipo sin vencimiento.
router.put(
  '/equipos/:idEquipo',
  requirePermission(PERMISOS.EQUIPOS_GESTIONAR),
  validateBody(editarSchema),
  async (req, res) => {
    const actual = await findEquipo(req.auth.usuario.empresaId, req.params.idEquipo);
    const datos = { ...toEquipoDto(actual), ...req.body };
    const {
      rows: [e],
    } = await pool.query(
      `UPDATE equipo
          SET tipo = $2, nombre = $3, ubicacion = $4, fecha_vencimiento = $5,
              estado = $6, notas = $7, actualizado_en = now()
        WHERE id_equipo = $1
    RETURNING *`,
      [actual.id_equipo, datos.tipo, datos.nombre, datos.ubicacion, datos.fechaVencimiento, datos.estado, datos.notas ?? '']
    );
    res.json({ equipo: toEquipoDto(e) });
  }
);

router.delete('/equipos/:idEquipo', requirePermission(PERMISOS.EQUIPOS_GESTIONAR), async (req, res) => {
  const equipo = await findEquipo(req.auth.usuario.empresaId, req.params.idEquipo);
  await pool.query('DELETE FROM equipo WHERE id_equipo = $1', [equipo.id_equipo]);
  res.status(204).end();
});

export default router;
