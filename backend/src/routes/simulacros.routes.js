import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { notFound } from '../lib/errors.js';
import { hoyEnColombia } from '../lib/fechas.js';
import { PERMISOS } from '../lib/roles.js';
import { uuidSchema, validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-12 y HU-13: evidencia de los simulacros de evacuación de cada sede.
// La norma pide al menos uno al año; el panel de cumplimiento y el reporte
// para auditoría se alimentan de este registro.

const router = Router({ mergeParams: true });
router.use(authenticate, requirePermission(PERMISOS.MAPA_VER));

const fecha = z
  .string('Indica la fecha del simulacro.')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica la fecha del simulacro.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Indica una fecha válida.');

const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => v || null);

const simulacroSchema = z.object({
  fecha,
  participantes: z.coerce
    .number('Indica cuántas personas participaron.')
    .int('Indica un número entero de participantes.')
    .min(1, 'Indica cuántas personas participaron.')
    .max(100000, 'Revisa el número de participantes.'),
  tiempoEvacuacion: textoOpcional(20),
  observaciones: textoOpcional(1000),
  planMejora: textoOpcional(1000),
});

const COLUMNAS = `s.id_simulacro, s.id_sede, s.fecha, s.participantes, s.tiempo_evacuacion,
  s.observaciones, s.plan_mejora, s.creado_en, u.nombre AS registrado_por`;

export function toSimulacroDto(row) {
  return {
    id: row.id_simulacro,
    sedeId: row.id_sede,
    fecha: row.fecha, // 'YYYY-MM-DD' (ver config/db.js)
    participantes: row.participantes,
    tiempoEvacuacion: row.tiempo_evacuacion,
    observaciones: row.observaciones,
    planMejora: row.plan_mejora,
    registradoPor: row.registrado_por,
    creadoEn: row.creado_en,
  };
}

router.get('/', async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
       FROM simulacro s
       LEFT JOIN usuario u ON u.id_usuario = s.id_usuario
      WHERE s.id_sede = $1
      ORDER BY s.fecha DESC, s.creado_en DESC`,
    [sede.id_sede]
  );
  res.json({ simulacros: rows.map(toSimulacroDto) });
});

router.post(
  '/',
  requirePermission(PERMISOS.SIMULACROS_GESTIONAR),
  validateBody(
    simulacroSchema.refine((d) => d.fecha <= hoyEnColombia(), {
      path: ['fecha'],
      message: 'Registra solo simulacros que ya se hicieron.',
    })
  ),
  async (req, res) => {
    const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
    const { fecha, participantes, tiempoEvacuacion, observaciones, planMejora } = req.body;
    const { rows } = await pool.query(
      `WITH nuevo AS (
         INSERT INTO simulacro
           (id_sede, id_usuario, fecha, participantes, tiempo_evacuacion, observaciones, plan_mejora)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *
       )
       SELECT ${COLUMNAS} FROM nuevo s LEFT JOIN usuario u ON u.id_usuario = s.id_usuario`,
      [sede.id_sede, req.auth.usuario.id, fecha, participantes, tiempoEvacuacion, observaciones, planMejora]
    );
    res.status(201).json({ simulacro: toSimulacroDto(rows[0]) });
  }
);

router.delete('/:idSimulacro', requirePermission(PERMISOS.SIMULACROS_GESTIONAR), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  if (!uuidSchema.safeParse(req.params.idSimulacro).success) throw notFound('No encontramos ese simulacro.');
  const { rowCount } = await pool.query(
    'DELETE FROM simulacro WHERE id_simulacro = $1 AND id_sede = $2',
    [req.params.idSimulacro, sede.id_sede]
  );
  if (!rowCount) throw notFound('No encontramos ese simulacro.');
  res.status(204).end();
});

export default router;
