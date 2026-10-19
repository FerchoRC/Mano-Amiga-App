import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/passwords.js';
import { contrasenaSchema, validateBody } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import {
  closeAllSessions,
  closeSession,
  createSession,
  getSessionPayload,
} from '../services/sessions.js';

// Sin reglas de formato: cualquier fallo responde igual para no dar pistas.
const loginSchema = z.object({
  correo: z.string('Escribe tu correo.').trim().toLowerCase().min(1, 'Escribe tu correo.').max(254),
  contrasena: z.string('Escribe tu contraseña.').min(1, 'Escribe tu contraseña.').max(200),
});

const router = Router();

// HU-02: inicio de sesión con correo y contraseña.
router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { correo, contrasena } = req.body;

  const {
    rows: [usuario],
  } = await pool.query(
    'SELECT id_usuario, contrasena_hash, activo FROM usuario WHERE lower(correo) = $1',
    [correo]
  );

  // Siempre se compara un hash (real o de relleno) para que el tiempo de
  // respuesta sea el mismo exista o no la cuenta.
  const valida = usuario?.contrasena_hash
    ? await verifyPassword(contrasena, usuario.contrasena_hash)
    : await verifyAgainstDummy(contrasena);

  if (!valida) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'El correo o la contraseña no son correctos.');
  }
  if (!usuario.activo) {
    throw new AppError(
      403,
      'USUARIO_INACTIVO',
      'Tu cuenta está desactivada. Habla con el administrador de tu empresa.'
    );
  }

  const token = await createSession(pool, usuario.id_usuario);
  res.json({ token, ...(await getSessionPayload(pool, usuario.id_usuario)) });
});

router.post('/logout', authenticate, async (req, res) => {
  await closeSession(req.auth.sesionId);
  res.status(204).end();
});

router.get('/sesion', authenticate, async (req, res) => {
  res.json(await getSessionPayload(pool, req.auth.usuario.id));
});

const cambioContrasenaSchema = z.object({
  contrasenaActual: z.string().max(200).optional(),
  contrasenaNueva: contrasenaSchema,
});

// Cambiar la propia contraseña. Con contraseña temporal no se pide la actual:
// la persona acaba de entrar con ella. Cierra las demás sesiones abiertas.
router.put('/contrasena', authenticate, validateBody(cambioContrasenaSchema), async (req, res) => {
  const { contrasenaActual, contrasenaNueva } = req.body;
  const { id } = req.auth.usuario;

  const {
    rows: [usuario],
  } = await pool.query(
    'SELECT contrasena_hash, debe_cambiar_contrasena FROM usuario WHERE id_usuario = $1',
    [id]
  );

  if (!usuario.debe_cambiar_contrasena) {
    const valida = contrasenaActual && (await verifyPassword(contrasenaActual, usuario.contrasena_hash));
    if (!valida) {
      const mensaje = 'La contraseña actual no es correcta.';
      throw new AppError(400, 'CONTRASENA_ACTUAL_INCORRECTA', mensaje, { contrasenaActual: mensaje });
    }
  }
  if (await verifyPassword(contrasenaNueva, usuario.contrasena_hash)) {
    const mensaje = 'La nueva contraseña debe ser distinta a la actual.';
    throw new AppError(400, 'MISMA_CONTRASENA', mensaje, { contrasenaNueva: mensaje });
  }

  const hash = await hashPassword(contrasenaNueva);
  await withTransaction(async (db) => {
    await db.query(
      'UPDATE usuario SET contrasena_hash = $2, debe_cambiar_contrasena = false WHERE id_usuario = $1',
      [id, hash]
    );
    await closeAllSessions(db, id, req.auth.sesionId);
  });

  res.json(await getSessionPayload(pool, id));
});

// Latido del frontend mientras el usuario interactúa con la página.
// `authenticate` ya renovó la actividad de la sesión.
router.post('/actividad', authenticate, (_req, res) => {
  res.status(204).end();
});

export default router;
