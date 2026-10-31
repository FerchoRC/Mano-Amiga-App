import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION } from '../lib/errors.js';
import { PERMISOS, tienePermiso } from '../lib/roles.js';
import { validateBody } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { geocodingLimiter } from '../middleware/rateLimit.js';
import { buscarDireccion } from '../services/geocoding.js';
import { findSede, listSedes, toSedeDto } from '../services/sedes.js';

const MENSAJE_UBICACION = 'Marca la ubicación de la sede en el mapa.';

const sedeSchema = z.object({
  nombre: z
    .string('Escribe el nombre de la sede.')
    .trim()
    .min(2, 'Escribe el nombre de la sede.')
    .max(120, 'El nombre es demasiado largo.'),
  direccion: z
    .string('Escribe la dirección de la sede.')
    .trim()
    .min(5, 'Escribe la dirección de la sede.')
    .max(200, 'La dirección es demasiado larga.'),
  ciudad: z
    .string('Escribe la ciudad.')
    .trim()
    .min(2, 'Escribe la ciudad.')
    .max(80, 'El nombre de la ciudad es demasiado largo.'),
  lat: z.number(MENSAJE_UBICACION).min(-90, MENSAJE_UBICACION).max(90, MENSAJE_UBICACION),
  lng: z.number(MENSAJE_UBICACION).min(-180, MENSAJE_UBICACION).max(180, MENSAJE_UBICACION),
});

function nombreDuplicado(error) {
  if (error.code === PG_UNIQUE_VIOLATION && error.constraint === 'sede_nombre_unico') {
    const mensaje = 'Ya tienes una sede con este nombre.';
    return new AppError(409, 'SEDE_DUPLICADA', mensaje, { nombre: mensaje });
  }
  return error;
}

const verBorradores = (req) => tienePermiso(req.auth.usuario.rol, PERMISOS.PLANES_GESTIONAR);

const router = Router();
router.use(authenticate, requirePermission(PERMISOS.SEDES_VER));

// HU-04: una empresa puede tener varias sedes.
router.get('/', async (req, res) => {
  const rows = await listSedes(pool, req.auth.usuario.empresaId);
  res.json({ sedes: rows.map((row) => toSedeDto(row, { verBorradores: verBorradores(req) })) });
});

// Ubica una dirección en el mapa para el formulario de la sede.
router.get(
  '/geocodificar',
  requirePermission(PERMISOS.SEDES_GESTIONAR),
  geocodingLimiter,
  async (req, res) => {
    const texto = String(req.query.q ?? '').trim();
    if (texto.length < 3 || texto.length > 200) {
      throw new AppError(400, 'BUSQUEDA_INVALIDA', 'Escribe una dirección o un lugar para buscar.');
    }
    try {
      res.json({ resultados: await buscarDireccion(texto) });
    } catch (error) {
      console.error('[geocodificación]', error.message);
      throw new AppError(
        503,
        'MAPA_NO_DISPONIBLE',
        'No pudimos buscar la dirección en este momento. Ubica la sede directamente en el mapa.'
      );
    }
  }
);

router.get('/:id', async (req, res) => {
  const row = await findSede(pool, req.auth.usuario.empresaId, req.params.id);
  res.json({ sede: toSedeDto(row, { verBorradores: verBorradores(req) }) });
});

router.post(
  '/',
  requirePermission(PERMISOS.SEDES_GESTIONAR),
  validateBody(sedeSchema),
  async (req, res) => {
    const { nombre, direccion, ciudad, lat, lng } = req.body;
    let creada;
    try {
      ({
        rows: [creada],
      } = await pool.query(
        `INSERT INTO sede (id_empresa, nombre, direccion, ciudad, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_sede`,
        [req.auth.usuario.empresaId, nombre, direccion, ciudad, lat, lng]
      ));
    } catch (error) {
      throw nombreDuplicado(error);
    }
    const row = await findSede(pool, req.auth.usuario.empresaId, creada.id_sede);
    res.status(201).json({ sede: toSedeDto(row, { verBorradores: true }) });
  }
);

router.put(
  '/:id',
  requirePermission(PERMISOS.SEDES_GESTIONAR),
  validateBody(sedeSchema),
  async (req, res) => {
    const { empresaId } = req.auth.usuario;
    const sede = await findSede(pool, empresaId, req.params.id);
    const { nombre, direccion, ciudad, lat, lng } = req.body;
    try {
      await pool.query(
        `UPDATE sede
            SET nombre = $3, direccion = $4, ciudad = $5, lat = $6, lng = $7, actualizado_en = now()
          WHERE id_empresa = $1 AND id_sede = $2`,
        [empresaId, sede.id_sede, nombre, direccion, ciudad, lat, lng]
      );
    } catch (error) {
      throw nombreDuplicado(error);
    }
    const row = await findSede(pool, empresaId, sede.id_sede);
    res.json({ sede: toSedeDto(row, { verBorradores: true }) });
  }
);

// Eliminar la sede elimina también su plan de emergencias y sus versiones.
router.delete('/:id', requirePermission(PERMISOS.SEDES_GESTIONAR), async (req, res) => {
  const { empresaId } = req.auth.usuario;
  const sede = await findSede(pool, empresaId, req.params.id);
  await pool.query('DELETE FROM sede WHERE id_empresa = $1 AND id_sede = $2', [
    empresaId,
    sede.id_sede,
  ]);
  res.status(204).end();
});

export default router;
