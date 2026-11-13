import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION, notFound } from '../lib/errors.js';
import { PERMISOS } from '../lib/roles.js';
import { uuidSchema, validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { realtime } from '../services/realtime.js';
import { findSede } from '../services/sedes.js';

// HU-09: enviar una alerta de emergencia a las personas de una sede.
// HU-10: cada persona marca "Estoy a salvo" o "Necesito ayuda" mientras la
// alerta está activa, y los brigadistas ven confirmados y pendientes en tiempo real.

export const TIPOS_EMERGENCIA = ['incendio', 'sismo', 'evacuacion', 'inundacion', 'medica', 'amenaza', 'otra'];

// Destinatarios de una alerta: personas activas de la empresa que pertenecen a
// la sede de la alerta o que no tienen sede asignada (reciben todas).
const ES_DESTINATARIO = `
  u.id_empresa = a.id_empresa
  AND u.activo
  AND u.contrasena_hash IS NOT NULL
  AND (u.id_sede IS NULL OR u.id_sede = a.id_sede)`;

const enviarSchema = z.object({
  sedeId: z.uuid('Elige la sede de la emergencia.'),
  tipo: z.enum(TIPOS_EMERGENCIA, 'Elige el tipo de emergencia.'),
  instrucciones: z
    .string('Escribe las instrucciones.')
    .trim()
    .min(5, 'Escribe qué deben hacer las personas.')
    .max(1000, 'Las instrucciones admiten máximo 1000 caracteres.'),
});

const respuestaSchema = z.object({
  estado: z.enum(['a_salvo', 'necesita_ayuda'], 'Elige "Estoy a salvo" o "Necesito ayuda".'),
  mensaje: z.string().trim().max(300, 'El mensaje admite máximo 300 caracteres.').default(''),
});

function toAlertaDto(row) {
  return {
    id: row.id_alerta,
    sedeId: row.id_sede,
    sedeNombre: row.sede_nombre,
    tipo: row.tipo,
    instrucciones: row.instrucciones,
    activa: row.activa,
    creadoEn: row.creado_en,
    finalizadoEn: row.finalizado_en,
    remitenteId: row.id_usuario,
    remitenteNombre: row.remitente_nombre,
    miRespuesta: row.mi_estado
      ? { estado: row.mi_estado, mensaje: row.mi_mensaje, respondidoEn: row.mi_respondido_en }
      : null,
  };
}

const persona = (row) => ({ id: row.id_usuario, nombre: row.nombre, correo: row.correo, rol: row.rol });

// Alerta de la empresa con la respuesta del usuario actual, o 404.
async function findAlerta(empresaId, idAlerta, idUsuario) {
  if (!uuidSchema.safeParse(idAlerta).success) throw notFound('No encontramos esa alerta.');
  const { rows } = await pool.query(
    `SELECT a.*, s.nombre AS sede_nombre, u.nombre AS remitente_nombre,
            r.estado AS mi_estado, r.mensaje AS mi_mensaje, r.respondido_en AS mi_respondido_en
       FROM alerta a
       JOIN sede s ON s.id_sede = a.id_sede
       JOIN usuario u ON u.id_usuario = a.id_usuario
  LEFT JOIN alerta_respuesta r ON r.id_alerta = a.id_alerta AND r.id_usuario = $3
      WHERE a.id_empresa = $1 AND a.id_alerta = $2`,
    [empresaId, idAlerta, idUsuario]
  );
  if (!rows[0]) throw notFound('No encontramos esa alerta.');
  return rows[0];
}

const router = Router();
router.use(authenticate, requirePermission(PERMISOS.ALERTAS_VER));

// Alerta activa que le corresponde a quien consulta (la de su sede, o cualquiera
// si no tiene sede). Opcionalmente filtrada con ?sedeId=.
router.get('/activa', async (req, res) => {
  const { empresaId, id: idUsuario } = req.auth.usuario;
  const params = [empresaId, idUsuario];
  let filtro = '';
  if (req.query.sedeId) {
    if (!uuidSchema.safeParse(req.query.sedeId).success) return res.json({ alerta: null });
    params.push(req.query.sedeId);
    filtro = 'AND a.id_sede = $3';
  }

  const { rows } = await pool.query(
    `SELECT a.*, s.nombre AS sede_nombre, emisor.nombre AS remitente_nombre,
            r.estado AS mi_estado, r.mensaje AS mi_mensaje, r.respondido_en AS mi_respondido_en
       FROM alerta a
       JOIN sede s ON s.id_sede = a.id_sede
       JOIN usuario emisor ON emisor.id_usuario = a.id_usuario
       JOIN usuario yo ON yo.id_usuario = $2
  LEFT JOIN alerta_respuesta r ON r.id_alerta = a.id_alerta AND r.id_usuario = $2
      WHERE a.id_empresa = $1 AND a.activa
        AND (yo.id_sede IS NULL OR yo.id_sede = a.id_sede)
        ${filtro}
      ORDER BY a.creado_en DESC
      LIMIT 1`,
    params
  );
  res.json({ alerta: rows[0] ? toAlertaDto(rows[0]) : null });
});

// HU-09: enviar una alerta (administrador o brigadista).
router.post('/', requirePermission(PERMISOS.ALERTAS_ENVIAR), validateBody(enviarSchema), async (req, res) => {
  const { empresaId, id: idUsuario } = req.auth.usuario;
  const { sedeId, tipo, instrucciones } = req.body;
  const sede = await findSede(pool, empresaId, sedeId);

  let creada;
  try {
    ({
      rows: [creada],
    } = await pool.query(
      `INSERT INTO alerta (id_empresa, id_sede, id_usuario, tipo, instrucciones, activa)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id_alerta`,
      [empresaId, sede.id_sede, idUsuario, tipo, instrucciones]
    ));
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new AppError(
        409,
        'ALERTA_ACTIVA',
        `Ya hay una alerta activa en ${sede.nombre}. Finalízala antes de enviar otra.`
      );
    }
    throw error;
  }

  const alerta = await findAlerta(empresaId, creada.id_alerta, idUsuario);
  const {
    rows: [{ total }],
  } = await pool.query(
    `SELECT count(*)::int AS total FROM usuario u, alerta a WHERE a.id_alerta = $1 AND ${ES_DESTINATARIO}`,
    [alerta.id_alerta]
  );

  realtime.toEmpresa(empresaId, 'alerta:nueva', { alertaId: alerta.id_alerta, sedeId: alerta.id_sede });
  res.status(201).json({ alerta: toAlertaDto(alerta), destinatarios: total });
});

// Dar por terminada la emergencia.
router.post('/:idAlerta/finalizar', requirePermission(PERMISOS.ALERTAS_ENVIAR), async (req, res) => {
  const { empresaId, id: idUsuario } = req.auth.usuario;
  const alerta = await findAlerta(empresaId, req.params.idAlerta, idUsuario);
  if (!alerta.activa) {
    throw new AppError(409, 'ALERTA_FINALIZADA', 'Esta alerta ya había sido finalizada.');
  }

  await pool.query(
    `UPDATE alerta SET activa = false, finalizado_en = now(), finalizado_por = $2
      WHERE id_alerta = $1 AND activa`,
    [alerta.id_alerta, idUsuario]
  );

  const evento = { alertaId: alerta.id_alerta, sedeId: alerta.id_sede };
  realtime.toEmpresa(empresaId, 'alerta:finalizada', evento);
  realtime.toAlerta(alerta.id_alerta, 'alerta:finalizada', evento);
  res.json({ ok: true, alertaId: alerta.id_alerta });
});

// HU-10: confirmados y pendientes. Solo lo ven brigadistas y administradores.
router.get('/:idAlerta/respuestas', requirePermission(PERMISOS.ALERTAS_ENVIAR), async (req, res) => {
  const { empresaId, id: idUsuario } = req.auth.usuario;
  const alerta = await findAlerta(empresaId, req.params.idAlerta, idUsuario);

  const [respuestas, pendientes] = await Promise.all([
    pool.query(
      `SELECT r.id_respuesta, r.estado, r.mensaje, r.respondido_en,
              u.id_usuario, u.nombre, u.correo, u.rol
         FROM alerta_respuesta r
         JOIN usuario u ON u.id_usuario = r.id_usuario
        WHERE r.id_alerta = $1
        ORDER BY r.estado = 'necesita_ayuda' DESC, r.respondido_en DESC`,
      [alerta.id_alerta]
    ),
    pool.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.rol
         FROM usuario u, alerta a
        WHERE a.id_alerta = $1 AND ${ES_DESTINATARIO}
          AND NOT EXISTS (
            SELECT 1 FROM alerta_respuesta r WHERE r.id_alerta = a.id_alerta AND r.id_usuario = u.id_usuario
          )
        ORDER BY lower(u.nombre)`,
      [alerta.id_alerta]
    ),
  ]);

  res.json({
    alerta: toAlertaDto(alerta),
    respuestas: respuestas.rows.map((r) => ({
      id: r.id_respuesta,
      alertaId: alerta.id_alerta,
      estado: r.estado,
      mensaje: r.mensaje,
      respondidoEn: r.respondido_en,
      usuario: persona(r),
    })),
    pendientes: pendientes.rows.map((u) => ({ usuario: persona(u) })),
  });
});

// HU-10: marcar el propio estado, solo mientras la alerta está activa.
router.post('/:idAlerta/respuestas', validateBody(respuestaSchema), async (req, res) => {
  const usuario = req.auth.usuario;
  const alerta = await findAlerta(usuario.empresaId, req.params.idAlerta, usuario.id);
  if (!alerta.activa) {
    throw new AppError(409, 'ALERTA_FINALIZADA', 'La emergencia ya fue finalizada.');
  }

  const { rowCount: esDestinatario } = await pool.query(
    `SELECT 1 FROM usuario u, alerta a WHERE a.id_alerta = $1 AND u.id_usuario = $2 AND ${ES_DESTINATARIO}`,
    [alerta.id_alerta, usuario.id]
  );
  if (!esDestinatario) {
    throw new AppError(403, 'OTRA_SEDE', 'Esta alerta es para las personas de otra sede.');
  }

  const {
    rows: [r],
  } = await pool.query(
    `INSERT INTO alerta_respuesta (id_alerta, id_usuario, estado, mensaje)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_alerta, id_usuario)
     DO UPDATE SET estado = EXCLUDED.estado, mensaje = EXCLUDED.mensaje, respondido_en = now()
     RETURNING id_respuesta, estado, mensaje, respondido_en`,
    [alerta.id_alerta, usuario.id, req.body.estado, req.body.mensaje]
  );

  const respuesta = {
    id: r.id_respuesta,
    alertaId: alerta.id_alerta,
    estado: r.estado,
    mensaje: r.mensaje,
    respondidoEn: r.respondido_en,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };

  // Solo a la sala de la alerta, donde únicamente entran brigadistas y administradores.
  realtime.toAlerta(alerta.id_alerta, 'alerta:respuesta', respuesta);
  res.status(201).json({ respuesta });
});

export default router;
