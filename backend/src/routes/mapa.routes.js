import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { notFound } from '../lib/errors.js';
import { PERMISOS } from '../lib/roles.js';
import { uuidSchema, validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { realtime } from '../services/realtime.js';
import { findSede } from '../services/sedes.js';

// HU-07: mapa de evacuación de una sede, para que cualquier persona de la
// empresa sepa cómo actuar.

export const TIPOS_PUNTO = ['punto_encuentro', 'salida', 'extintor', 'botiquin', 'camilla'];

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

// HU-08: editar los puntos del mapa. Criterios: solo el administrador puede
// editarlo, y los cambios se ven de inmediato para todas las personas de la sede
// (cada cambio se avisa en tiempo real y los clientes recargan el mapa).

const MENSAJE_UBICACION = 'Marca la ubicación del punto en el mapa.';

const camposPunto = {
  tipo: z.enum(TIPOS_PUNTO, 'Elige el tipo de punto.'),
  nombre: z.string('Escribe el nombre del punto.').trim().min(2, 'Escribe el nombre del punto.').max(120, 'Máximo 120 caracteres.'),
  descripcion: z.string().trim().max(300, 'La descripción admite máximo 300 caracteres.'),
  lat: z.number(MENSAJE_UBICACION).min(-90, MENSAJE_UBICACION).max(90, MENSAJE_UBICACION),
  lng: z.number(MENSAJE_UBICACION).min(-180, MENSAJE_UBICACION).max(180, MENSAJE_UBICACION),
};

const crearPuntoSchema = z.object({ ...camposPunto, descripcion: camposPunto.descripcion.default('') });
const editarPuntoSchema = z
  .object(camposPunto)
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay cambios para guardar.' });

const toPuntoDto = (p) => ({
  id: p.id_punto,
  tipo: p.tipo,
  nombre: p.nombre,
  descripcion: p.descripcion,
  lat: Number(p.lat),
  lng: Number(p.lng),
});

async function findPunto(idSede, idPunto) {
  if (!uuidSchema.safeParse(idPunto).success) throw notFound('No encontramos ese punto en el mapa.');
  const { rows } = await pool.query('SELECT * FROM mapa_punto WHERE id_punto = $1 AND id_sede = $2', [
    idPunto,
    idSede,
  ]);
  if (!rows[0]) throw notFound('No encontramos ese punto en el mapa.');
  return rows[0];
}

const avisarCambio = (req, sede) =>
  realtime.toEmpresa(req.auth.usuario.empresaId, 'mapa:actualizado', { sedeId: sede.id_sede });

const gestionar = requirePermission(PERMISOS.MAPA_GESTIONAR);

router.post('/puntos', gestionar, validateBody(crearPuntoSchema), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const { tipo, nombre, descripcion, lat, lng } = req.body;
  const {
    rows: [p],
  } = await pool.query(
    `INSERT INTO mapa_punto (id_sede, tipo, nombre, descripcion, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [sede.id_sede, tipo, nombre, descripcion, lat, lng]
  );
  avisarCambio(req, sede);
  res.status(201).json({ punto: toPuntoDto(p) });
});

// Mover (lat/lng) o renombrar un punto: solo cambian los campos enviados.
router.put('/puntos/:idPunto', gestionar, validateBody(editarPuntoSchema), async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const actual = await findPunto(sede.id_sede, req.params.idPunto);
  const datos = { ...toPuntoDto(actual), ...req.body };
  const {
    rows: [p],
  } = await pool.query(
    `UPDATE mapa_punto SET tipo = $2, nombre = $3, descripcion = $4, lat = $5, lng = $6
      WHERE id_punto = $1
  RETURNING *`,
    [actual.id_punto, datos.tipo, datos.nombre, datos.descripcion, datos.lat, datos.lng]
  );
  avisarCambio(req, sede);
  res.json({ punto: toPuntoDto(p) });
});

router.delete('/puntos/:idPunto', gestionar, async (req, res) => {
  const sede = await findSede(pool, req.auth.usuario.empresaId, req.params.idSede);
  const punto = await findPunto(sede.id_sede, req.params.idPunto);
  await pool.query('DELETE FROM mapa_punto WHERE id_punto = $1', [punto.id_punto]);
  avisarCambio(req, sede);
  res.status(204).end();
});

export default router;
