import { Router } from 'express';

import { pool } from '../config/db.js';
import { PERMISOS } from '../lib/roles.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-11: Inventario de equipos

const router = Router();
router.use(authenticate);

// Listar equipos de una sede
router.get('/sedes/:idSede/equipos', requirePermission(PERMISOS.EQUIPOS_VER), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);

  const { rows } = await pool.query(
    `SELECT id_equipo, id_sede, tipo, nombre, ubicacion, fecha_vencimiento, estado, notas, creado_en, actualizado_en
       FROM equipo
      WHERE id_sede = $1
      ORDER BY fecha_vencimiento ASC NULLS LAST, lower(nombre)`,
    [sede.id_sede]
  );

  res.json({
    equipos: rows.map((e) => ({
      id: e.id_equipo,
      sedeId: e.id_sede,
      tipo: e.tipo,
      nombre: e.nombre,
      ubicacion: e.ubicacion,
      fechaVencimiento: e.fecha_vencimiento ? e.fecha_vencimiento.toISOString().slice(0, 10) : null,
      estado: e.estado,
      notas: e.notas,
      creadoEn: e.creado_en,
      actualizadoEn: e.actualizado_en,
    })),
  });
});

// Registrar nuevo equipo en una sede (administrador)
router.post('/sedes/:idSede/equipos', requirePermission(PERMISOS.EQUIPOS_GESTIONAR), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { tipo, nombre, ubicacion, fechaVencimiento, estado = 'operativo', notas = '' } = req.body;

  if (!tipo || !nombre || !ubicacion) {
    return res.status(400).json({
      error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Debes indicar tipo, nombre y ubicación del equipo.' },
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO equipo (id_sede, tipo, nombre, ubicacion, fecha_vencimiento, estado, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_equipo, id_sede, tipo, nombre, ubicacion, fecha_vencimiento, estado, notas, creado_en, actualizado_en`,
    [sede.id_sede, tipo, nombre.trim(), ubicacion.trim(), fechaVencimiento || null, estado, notas.trim()]
  );

  const e = rows[0];
  res.status(201).json({
    equipo: {
      id: e.id_equipo,
      sedeId: e.id_sede,
      tipo: e.tipo,
      nombre: e.nombre,
      ubicacion: e.ubicacion,
      fechaVencimiento: e.fecha_vencimiento ? e.fecha_vencimiento.toISOString().slice(0, 10) : null,
      estado: e.estado,
      notas: e.notas,
      creadoEn: e.creado_en,
      actualizadoEn: e.actualizado_en,
    },
  });
});

// Actualizar equipo
router.put('/equipos/:idEquipo', requirePermission(PERMISOS.EQUIPOS_GESTIONAR), async (req, res) => {
  const { tipo, nombre, ubicacion, fechaVencimiento, estado, notas } = req.body;
  const empresaId = req.auth.usuario.empresaId;

  const { rows } = await pool.query(
    `UPDATE equipo e
        SET tipo = COALESCE($1, e.tipo),
            nombre = COALESCE($2, e.nombre),
            ubicacion = COALESCE($3, e.ubicacion),
            fecha_vencimiento = CASE WHEN $4::text IS NOT NULL THEN $4::date ELSE e.fecha_vencimiento END,
            estado = COALESCE($5, e.estado),
            notas = COALESCE($6, e.notas),
            actualizado_en = now()
       FROM sede s
      WHERE e.id_equipo = $7 AND e.id_sede = s.id_sede AND s.id_empresa = $8
  RETURNING e.id_equipo, e.id_sede, e.tipo, e.nombre, e.ubicacion, e.fecha_vencimiento, e.estado, e.notas, e.creado_en, e.actualizado_en`,
    [
      tipo,
      nombre?.trim(),
      ubicacion?.trim(),
      fechaVencimiento !== undefined ? fechaVencimiento : null,
      estado,
      notas !== undefined ? notas.trim() : null,
      req.params.idEquipo,
      empresaId,
    ]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: { codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Equipo no encontrado.' } });
  }

  const e = rows[0];
  res.json({
    equipo: {
      id: e.id_equipo,
      sedeId: e.id_sede,
      tipo: e.tipo,
      nombre: e.nombre,
      ubicacion: e.ubicacion,
      fechaVencimiento: e.fecha_vencimiento ? e.fecha_vencimiento.toISOString().slice(0, 10) : null,
      estado: e.estado,
      notas: e.notas,
      creadoEn: e.creado_en,
      actualizadoEn: e.actualizado_en,
    },
  });
});

// Eliminar equipo
router.delete('/equipos/:idEquipo', requirePermission(PERMISOS.EQUIPOS_GESTIONAR), async (req, res) => {
  const empresaId = req.auth.usuario.empresaId;

  const { rowCount } = await pool.query(
    `DELETE FROM equipo e
      USING sede s
      WHERE e.id_equipo = $1 AND e.id_sede = s.id_sede AND s.id_empresa = $2`,
    [req.params.idEquipo, empresaId]
  );

  if (!rowCount) {
    return res.status(404).json({ error: { codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Equipo no encontrado.' } });
  }

  res.status(204).end();
});

export default router;
