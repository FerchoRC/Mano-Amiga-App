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

export default router;
