import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION, notFound } from '../lib/errors.js';
import {
  contenidoSchema,
  contenidoVacio,
  limpiarContenido,
  plantillaPlan,
  revisarPlan,
} from '../lib/plan.js';
import { PERMISOS, tienePermiso } from '../lib/roles.js';
import { validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-05: plan de emergencias de cada sede, con estados borrador y aprobado
// y registro de quién lo creó, editó y aprobó, y cuándo.

const persona = (id, nombre) => (id ? { id, nombre } : null);

function toVersionDto(row, { conContenido = true } = {}) {
  return {
    numero: row.numero,
    estado: row.estado,
    ...(conContenido && { contenido: row.contenido }),
    creadoPor: persona(row.creado_por, row.creado_por_nombre),
    creadoEn: row.creado_en,
    actualizadoPor: persona(row.actualizado_por, row.actualizado_por_nombre),
    actualizadoEn: row.actualizado_en,
    aprobadoPor: persona(row.aprobado_por, row.aprobado_por_nombre),
    aprobadoEn: row.aprobado_en,
  };
}

async function findPlan(db, idSede) {
  const { rows } = await db.query(
    `SELECT p.*, u.nombre AS creado_por_nombre
       FROM plan_emergencia p
       LEFT JOIN usuario u ON u.id_usuario = p.creado_por
      WHERE p.id_sede = $1`,
    [idSede]
  );
  return rows[0] ?? null;
}

async function findVersiones(db, idPlan) {
  const { rows } = await db.query(
    `SELECT v.*,
            c.nombre  AS creado_por_nombre,
            a.nombre  AS actualizado_por_nombre,
            ap.nombre AS aprobado_por_nombre
       FROM plan_version v
       LEFT JOIN usuario c  ON c.id_usuario  = v.creado_por
       LEFT JOIN usuario a  ON a.id_usuario  = v.actualizado_por
       LEFT JOIN usuario ap ON ap.id_usuario = v.aprobado_por
      WHERE v.id_plan = $1
      ORDER BY v.numero DESC`,
    [idPlan]
  );
  return rows;
}

// Estado completo del plan. Quien solo puede verlo recibe únicamente versiones aprobadas.
async function planDeSede(db, idSede, gestor) {
  const plan = await findPlan(db, idSede);
  if (!plan) return { plan: null, vigente: null, borrador: null, versiones: [] };

  const versiones = (await findVersiones(db, plan.id_plan)).filter(
    (v) => gestor || v.estado === 'aprobado'
  );
  const vigente = versiones.find((v) => v.estado === 'aprobado');
  const borrador = gestor ? versiones.find((v) => v.estado === 'borrador') : null;

  if (!gestor && !vigente) return { plan: null, vigente: null, borrador: null, versiones: [] };

  return {
    plan: {
      id: plan.id_plan,
      creadoPor: persona(plan.creado_por, plan.creado_por_nombre),
      creadoEn: plan.creado_en,
    },
    vigente: vigente ? toVersionDto(vigente) : null,
    borrador: borrador ? toVersionDto(borrador) : null,
    versiones: versiones.map((v) => toVersionDto(v, { conContenido: false })),
  };
}

async function planOFalla(db, idSede) {
  const plan = await findPlan(db, idSede);
  if (!plan) throw new AppError(404, 'SIN_PLAN', 'Esta sede aún no tiene plan de emergencias.');
  return plan;
}

const sinBorrador = () =>
  new AppError(409, 'SIN_BORRADOR', 'Este plan no tiene un borrador abierto. Crea una nueva versión.');

const esGestor = (req) => tienePermiso(req.auth.usuario.rol, PERMISOS.PLANES_GESTIONAR);
const gestionar = requirePermission(PERMISOS.PLANES_GESTIONAR);

const router = Router({ mergeParams: true });
router.use(authenticate, requirePermission(PERMISOS.PLANES_VER));

// Verifica que la sede sea de la empresa antes de cualquier operación.
router.use(async (req, _res, next) => {
  req.sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  next();
});

router.get('/', async (req, res) => {
  res.json(await planDeSede(pool, req.sede.id_sede, esGestor(req)));
});

router.get('/versiones/:numero', async (req, res) => {
  const numero = Number(req.params.numero);
  const plan = await planOFalla(pool, req.sede.id_sede);
  const version = (await findVersiones(pool, plan.id_plan)).find(
    (v) => v.numero === numero && (esGestor(req) || v.estado === 'aprobado')
  );
  if (!version) throw notFound('No encontramos esa versión del plan.');
  res.json({ version: toVersionDto(version) });
});

// Crea el plan con su primera versión en borrador, vacía o desde la plantilla.
router.post(
  '/',
  gestionar,
  validateBody(z.object({ plantilla: z.boolean().default(false) })),
  async (req, res) => {
    const contenido = req.body.plantilla ? plantillaPlan() : contenidoVacio();
    const autor = req.auth.usuario.id;

    try {
      await withTransaction(async (db) => {
        const {
          rows: [plan],
        } = await db.query(
          'INSERT INTO plan_emergencia (id_sede, creado_por) VALUES ($1, $2) RETURNING id_plan',
          [req.sede.id_sede, autor]
        );
        await db.query(
          `INSERT INTO plan_version (id_plan, numero, estado, contenido, creado_por, actualizado_por)
           VALUES ($1, 1, 'borrador', $2, $3, $3)`,
          [plan.id_plan, contenido, autor]
        );
      });
    } catch (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new AppError(409, 'PLAN_EXISTENTE', 'Esta sede ya tiene un plan de emergencias.');
      }
      throw error;
    }

    res.status(201).json(await planDeSede(pool, req.sede.id_sede, true));
  }
);

// Guardar el borrador. Puede estar incompleto.
router.put(
  '/borrador',
  gestionar,
  validateBody(z.object({ contenido: contenidoSchema })),
  async (req, res) => {
    const plan = await planOFalla(pool, req.sede.id_sede);
    const { rowCount } = await pool.query(
      `UPDATE plan_version
          SET contenido = $2, actualizado_por = $3, actualizado_en = now()
        WHERE id_plan = $1 AND estado = 'borrador'`,
      [plan.id_plan, req.body.contenido, req.auth.usuario.id]
    );
    if (!rowCount) throw sinBorrador();
    res.json(await planDeSede(pool, req.sede.id_sede, true));
  }
);

// Aprobar el borrador. Desde aquí la versión queda fija como evidencia.
router.post('/borrador/aprobar', gestionar, async (req, res) => {
  const plan = await planOFalla(pool, req.sede.id_sede);

  await withTransaction(async (db) => {
    const {
      rows: [borrador],
    } = await db.query(
      `SELECT id_version, contenido FROM plan_version
        WHERE id_plan = $1 AND estado = 'borrador'
        FOR UPDATE`,
      [plan.id_plan]
    );
    if (!borrador) throw sinBorrador();

    const faltantes = revisarPlan(borrador.contenido);
    if (Object.keys(faltantes).length) {
      throw new AppError(
        422,
        'PLAN_INCOMPLETO',
        'Completa el plan antes de aprobarlo.',
        faltantes
      );
    }

    await db.query(
      `UPDATE plan_version
          SET estado = 'aprobado', contenido = $2, aprobado_por = $3, aprobado_en = now()
        WHERE id_version = $1`,
      [borrador.id_version, limpiarContenido(borrador.contenido), req.auth.usuario.id]
    );
  });

  res.json(await planDeSede(pool, req.sede.id_sede, true));
});

// Para cambiar un plan aprobado se abre una versión nueva a partir de la vigente.
router.post('/versiones', gestionar, async (req, res) => {
  const plan = await planOFalla(pool, req.sede.id_sede);
  const autor = req.auth.usuario.id;

  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT numero, estado, contenido FROM plan_version
        WHERE id_plan = $1
        ORDER BY numero DESC
        FOR UPDATE`,
      [plan.id_plan]
    );
    if (rows.some((v) => v.estado === 'borrador')) {
      throw new AppError(
        409,
        'BORRADOR_EXISTENTE',
        'Ya hay un borrador abierto de este plan. Termínalo o descártalo primero.'
      );
    }
    const vigente = rows.find((v) => v.estado === 'aprobado');

    await db.query(
      `INSERT INTO plan_version (id_plan, numero, estado, contenido, creado_por, actualizado_por)
       VALUES ($1, $2, 'borrador', $3, $4, $4)`,
      [plan.id_plan, rows[0].numero + 1, vigente.contenido, autor]
    );
  });

  res.status(201).json(await planDeSede(pool, req.sede.id_sede, true));
});

// Descartar el borrador. Si era la única versión, la sede vuelve a quedar sin plan.
router.delete('/borrador', gestionar, async (req, res) => {
  const plan = await planOFalla(pool, req.sede.id_sede);

  await withTransaction(async (db) => {
    const { rowCount } = await db.query(
      `DELETE FROM plan_version WHERE id_plan = $1 AND estado = 'borrador'`,
      [plan.id_plan]
    );
    if (!rowCount) throw sinBorrador();
    await db.query(
      `DELETE FROM plan_emergencia p
        WHERE p.id_plan = $1
          AND NOT EXISTS (SELECT 1 FROM plan_version v WHERE v.id_plan = p.id_plan)`,
      [plan.id_plan]
    );
  });

  res.json(await planDeSede(pool, req.sede.id_sede, true));
});

export default router;
