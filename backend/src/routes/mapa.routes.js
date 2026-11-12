import { Router } from 'express';

import { pool } from '../config/db.js';
import { PERMISOS } from '../lib/roles.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { findSede } from '../services/sedes.js';

// HU-07: mapa de evacuación de una sede, para que cualquier persona de la
// empresa sepa cómo actuar. La edición de puntos y rutas llega con HU-08.

const router = Router({ mergeParams: true });
router.use(authenticate, requirePermission(PERMISOS.MAPA_VER));

router.get('/', async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);

  const [puntos, rutas] = await Promise.all([
    pool.query(
      `SELECT id_punto, tipo, nombre, descripcion, lat, lng
         FROM mapa_punto
        WHERE id_sede = $1
        ORDER BY tipo, lower(nombre)`,
      [sede.id_sede]
    ),
    pool.query(
      `SELECT id_ruta, nombre, descripcion, origen, destino, trazado
         FROM mapa_ruta
        WHERE id_sede = $1
        ORDER BY lower(nombre)`,
      [sede.id_sede]
    ),
  ]);

  res.json({
    sede: { id: sede.id_sede, nombre: sede.nombre, lat: Number(sede.lat), lng: Number(sede.lng) },
    puntos: puntos.rows.map((p) => ({
      id: p.id_punto,
      tipo: p.tipo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      lat: Number(p.lat),
      lng: Number(p.lng),
    })),
    rutas: rutas.rows.map((r) => ({
      id: r.id_ruta,
      nombre: r.nombre,
      descripcion: r.descripcion,
      origen: r.origen,
      destino: r.destino,
      trazado: r.trazado,
    })),
  });
});

// HU-08: Editar puntos del mapa (solo administradores)
router.post('/puntos', requirePermission(PERMISOS.MAPA_GESTIONAR), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { tipo, nombre, descripcion = '', lat, lng } = req.body;

  if (!tipo || !nombre || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Faltan campos requeridos.' } });
  }

  const { rows } = await pool.query(
    `INSERT INTO mapa_punto (id_sede, tipo, nombre, descripcion, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_punto, tipo, nombre, descripcion, lat, lng`,
    [sede.id_sede, tipo, nombre.trim(), descripcion.trim(), lat, lng]
  );

  const p = rows[0];
  res.status(201).json({
    punto: {
      id: p.id_punto,
      tipo: p.tipo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      lat: Number(p.lat),
      lng: Number(p.lng),
    },
  });
});

router.put('/puntos/:idPunto', requirePermission(PERMISOS.MAPA_GESTIONAR), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { tipo, nombre, descripcion, lat, lng } = req.body;

  const { rows } = await pool.query(
    `UPDATE mapa_punto
        SET tipo = COALESCE($1, tipo),
            nombre = COALESCE($2, nombre),
            descripcion = COALESCE($3, descripcion),
            lat = COALESCE($4, lat),
            lng = COALESCE($5, lng)
      WHERE id_punto = $6 AND id_sede = $7
  RETURNING id_punto, tipo, nombre, descripcion, lat, lng`,
    [tipo, nombre?.trim(), descripcion !== undefined ? descripcion.trim() : null, lat, lng, req.params.idPunto, sede.id_sede]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: { codigo: 'PUNTO_NO_ENCONTRADO', mensaje: 'Punto no encontrado.' } });
  }

  const p = rows[0];
  res.json({
    punto: {
      id: p.id_punto,
      tipo: p.tipo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      lat: Number(p.lat),
      lng: Number(p.lng),
    },
  });
});

router.delete('/puntos/:idPunto', requirePermission(PERMISOS.MAPA_GESTIONAR), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);

  const { rowCount } = await pool.query(
    `DELETE FROM mapa_punto WHERE id_punto = $1 AND id_sede = $2`,
    [req.params.idPunto, sede.id_sede]
  );

  if (!rowCount) {
    return res.status(404).json({ error: { codigo: 'PUNTO_NO_ENCONTRADO', mensaje: 'Punto no encontrado.' } });
  }

  res.status(204).end();
});

export default router;
