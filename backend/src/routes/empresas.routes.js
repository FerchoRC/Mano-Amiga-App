import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION } from '../lib/errors.js';
import { hashPassword } from '../lib/passwords.js';
import { parseNit } from '../lib/nit.js';
import { SECTORES } from '../lib/sectores.js';
import { contrasenaSchema, correoSchema, nombreSchema, validateBody } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { createSession, getSessionPayload, toEmpresaDto } from '../services/sessions.js';

const MENSAJE_NIT_INVALIDO =
  'El NIT no es válido. Revisa los 9 dígitos y el dígito de verificación.';

const nitSchema = z.string('Escribe el NIT.').transform((valor, ctx) => {
  const nit = parseNit(valor);
  if (!nit) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_NIT_INVALIDO });
    return z.NEVER;
  }
  return nit;
});

const registroSchema = z.object({
  empresa: z.object({
    nit: nitSchema,
    razonSocial: z
      .string('Escribe la razón social.')
      .trim()
      .min(2, 'Escribe la razón social.')
      .max(150, 'La razón social es demasiado larga.'),
    sector: z.enum(SECTORES, 'Elige el sector de tu empresa.'),
    numEmpleados: z.coerce
      .number('Escribe el número de empleados.')
      .int('Escribe un número entero.')
      .min(1, 'La empresa debe tener al menos 1 empleado.')
      .max(1_000_000, 'Revisa el número de empleados.'),
  }),
  administrador: z.object({
    nombre: nombreSchema,
    correo: correoSchema,
    contrasena: contrasenaSchema,
  }),
  aceptaTratamientoDatos: z.literal(true, 'Debes aceptar la política de tratamiento de datos.'),
});

const router = Router();

// Ayuda al formulario a avisar del NIT duplicado antes de enviar.
router.get('/nit-disponible', publicLimiter, async (req, res) => {
  const nit = parseNit(req.query.nit);
  if (!nit) return res.json({ valido: false, disponible: false });

  const { rowCount } = await pool.query('SELECT 1 FROM empresa WHERE nit = $1', [nit.base]);
  res.json({ valido: true, disponible: rowCount === 0 });
});

// HU-01: registro de empresa. Quien la registra queda como Administrador.
router.post('/', publicLimiter, validateBody(registroSchema), async (req, res) => {
  const { empresa, administrador } = req.body;
  const contrasenaHash = await hashPassword(administrador.contrasena);

  try {
    const { token, payload } = await withTransaction(async (db) => {
      const {
        rows: [nueva],
      } = await db.query(
        `INSERT INTO empresa (nit, digito_verificacion, razon_social, sector, num_empleados)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_empresa`,
        [empresa.nit.base, empresa.nit.dv, empresa.razonSocial, empresa.sector, empresa.numEmpleados]
      );
      const {
        rows: [admin],
      } = await db.query(
        `INSERT INTO usuario (id_empresa, nombre, correo, contrasena_hash, rol)
         VALUES ($1, $2, $3, $4, 'administrador')
         RETURNING id_usuario`,
        [nueva.id_empresa, administrador.nombre, administrador.correo, contrasenaHash]
      );

      const token = await createSession(db, admin.id_usuario);
      return { token, payload: await getSessionPayload(db, admin.id_usuario) };
    });

    res.status(201).json({ token, ...payload });
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION && error.constraint === 'empresa_nit_key') {
      const mensaje =
        'Ya hay una empresa registrada con este NIT. Pide a su administrador que te invite.';
      throw new AppError(409, 'NIT_DUPLICADO', mensaje, { 'empresa.nit': mensaje });
    }
    if (error.code === PG_UNIQUE_VIOLATION && error.constraint === 'usuario_correo_unico') {
      const mensaje = 'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.';
      throw new AppError(409, 'CORREO_EN_USO', mensaje, { 'administrador.correo': mensaje });
    }
    throw error;
  }
});

router.get('/actual', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM empresa WHERE id_empresa = $1', [
    req.auth.usuario.empresaId,
  ]);
  res.json({ empresa: toEmpresaDto(rows[0]) });
});

export default router;
