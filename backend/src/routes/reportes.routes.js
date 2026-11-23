import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { hoyEnColombia, sumarDias } from '../lib/fechas.js';
import { PERMISOS } from '../lib/roles.js';
import { validar } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { cargarDatos } from '../services/cumplimiento.js';
import { generarReporte, SECCIONES } from '../services/reporteAuditoria.js';
import { findSede } from '../services/sedes.js';

// HU-12: reporte para auditoría en PDF, filtrado por sede y rango de fechas.

const router = Router();
router.use(authenticate, requirePermission(PERMISOS.REPORTES_VER));

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Usa una fecha válida.');

const filtrosSchema = z
  .object({
    sedeId: z.string().optional().transform((v) => v || null),
    desde: z.union([fecha, z.literal('')]).optional(),
    hasta: z.union([fecha, z.literal('')]).optional(),
    secciones: z
      .string()
      .optional()
      .transform((v) => (v ? [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))] : SECCIONES))
      .pipe(
        z
          .array(z.enum(SECCIONES, 'Elige secciones válidas.'), 'Elige secciones válidas.')
          .min(1, 'Elige al menos una sección.')
      ),
  })
  .transform((f) => {
    const hoy = hoyEnColombia();
    // Por defecto, el último año hasta hoy.
    const hasta = f.hasta || hoy;
    const desde = f.desde || sumarDias(hasta, -365);
    return { ...f, desde, hasta };
  })
  .refine((f) => f.desde <= f.hasta, { path: ['desde'], message: 'La fecha inicial debe ser anterior a la final.' })
  .refine((f) => f.hasta <= hoyEnColombia(), { path: ['hasta'], message: 'La fecha final no puede ser futura.' });

router.get('/auditoria', async (req, res) => {
  const { empresaId, nombre } = req.auth.usuario;
  const filtros = validar(filtrosSchema, req.query);
  const sede = filtros.sedeId ? await findSede(pool, empresaId, filtros.sedeId) : null;

  const [{ rows: empresas }, sedes] = await Promise.all([
    pool.query(
      'SELECT razon_social, nit, digito_verificacion, sector, num_empleados FROM empresa WHERE id_empresa = $1',
      [empresaId]
    ),
    cargarDatos(pool, empresaId, sede?.id_sede ?? null),
  ]);
  const empresa = empresas[0];

  const archivo = [
    'reporte-auditoria',
    slug(empresa.razon_social),
    sede && slug(sede.nombre),
    filtros.hasta,
  ]
    .filter(Boolean)
    .join('-');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');

  generarReporte(res, {
    empresa,
    sedes,
    desde: filtros.desde,
    hasta: filtros.hasta,
    secciones: filtros.secciones,
    emitidoPor: nombre,
  });
});

function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export default router;
