import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { PERMISOS } from '../lib/roles.js';
import { validar } from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { calcularCumplimiento, cargarDatos } from '../services/cumplimiento.js';
import { findSede } from '../services/sedes.js';

// HU-13: panel de cumplimiento del administrador (toda la empresa o una sede).

const router = Router();
router.use(authenticate, requirePermission(PERMISOS.CUMPLIMIENTO_VER));

const filtroSchema = z.object({
  sedeId: z.string().optional().transform((v) => v || null),
});

router.get('/', async (req, res) => {
  const { empresaId } = req.auth.usuario;
  const { sedeId } = validar(filtroSchema, req.query);
  if (sedeId) await findSede(pool, empresaId, sedeId); // 404 si no es de la empresa

  const sedes = await cargarDatos(pool, empresaId, sedeId);
  res.json(calcularCumplimiento(sedes));
});

export default router;
