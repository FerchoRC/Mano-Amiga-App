import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/passwords.js';
import { generateToken, hashToken } from '../lib/tokens.js';
import { contrasenaSchema, correoSchema, validateBody } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, publicLimiter, recuperacionLimiter } from '../middleware/rateLimit.js';
import { registrarConsentimiento } from '../services/consentimiento.js';
import { enviarRecuperacion } from '../services/mailer.js';
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

// ---------------------------------------------------------------------------
// Recuperación de contraseña por correo. La respuesta es la misma exista o no la cuenta,
// para no revelar qué correos están registrados. El enlace vence en una hora, sirve una
// sola vez y, al usarlo, se cierran todas las sesiones abiertas de la persona.

const MINUTOS_RECUPERACION = 60;
const RESPUESTA_RECUPERACION = {
  mensaje: 'Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.',
};

router.post(
  '/recuperar',
  recuperacionLimiter,
  validateBody(z.object({ correo: correoSchema })),
  async (req, res) => {
    const {
      rows: [usuario],
    } = await pool.query(
      `SELECT id_usuario, nombre, correo FROM usuario
        WHERE lower(correo) = $1 AND activo AND contrasena_hash IS NOT NULL`,
      [req.body.correo]
    );

    if (usuario) {
      const token = generateToken();
      await withTransaction(async (db) => {
        // Un enlace nuevo invalida los anteriores que no se usaron.
        await db.query('DELETE FROM recuperacion WHERE id_usuario = $1 AND usado_en IS NULL', [
          usuario.id_usuario,
        ]);
        await db.query(
          `INSERT INTO recuperacion (id_usuario, token_hash, expira_en)
           VALUES ($1, $2, now() + make_interval(mins => $3))`,
          [usuario.id_usuario, hashToken(token), MINUTOS_RECUPERACION]
        );
      });
      // Sin esperar el envío: así la respuesta tarda lo mismo exista o no la cuenta.
      enviarRecuperacion({
        para: usuario.correo,
        nombre: usuario.nombre,
        enlace: `${env.appUrl}/recuperar/${token}`,
      }).catch(() => {});
    }

    res.status(202).json(RESPUESTA_RECUPERACION);
  }
);

async function findRecuperacion(db, token, { bloquear = false } = {}) {
  const {
    rows: [fila],
  } = await db.query(
    `SELECT r.id_recuperacion, r.id_usuario, r.usado_en, r.expira_en < now() AS vencida,
            u.nombre, u.correo, u.activo
       FROM recuperacion r
       JOIN usuario u USING (id_usuario)
      WHERE r.token_hash = $1
      ${bloquear ? 'FOR UPDATE OF r' : ''}`,
    [hashToken(token)]
  );
  if (!fila || fila.usado_en || !fila.activo) {
    throw new AppError(404, 'ENLACE_INVALIDO', 'Este enlace ya se usó o no es válido. Pide uno nuevo.');
  }
  if (fila.vencida) {
    throw new AppError(410, 'ENLACE_VENCIDO', 'Este enlace venció. Pide uno nuevo.');
  }
  return fila;
}

router.get('/recuperar/:token', publicLimiter, async (req, res) => {
  const fila = await findRecuperacion(pool, req.params.token);
  res.json({ nombre: fila.nombre, correo: fila.correo });
});

router.post(
  '/recuperar/:token',
  publicLimiter,
  validateBody(z.object({ contrasena: contrasenaSchema })),
  async (req, res) => {
    const hash = await hashPassword(req.body.contrasena);
    const { token, payload } = await withTransaction(async (db) => {
      const fila = await findRecuperacion(db, req.params.token, { bloquear: true });
      await db.query(
        'UPDATE usuario SET contrasena_hash = $2, debe_cambiar_contrasena = false WHERE id_usuario = $1',
        [fila.id_usuario, hash]
      );
      await db.query('UPDATE recuperacion SET usado_en = now() WHERE id_recuperacion = $1', [
        fila.id_recuperacion,
      ]);
      await closeAllSessions(db, fila.id_usuario);
      const token = await createSession(db, fila.id_usuario);
      return { token, payload: await getSessionPayload(db, fila.id_usuario) };
    });
    res.json({ token, ...payload });
  }
);

// Ley 1581: la persona acepta la política de tratamiento de datos vigente. Lo hacen
// quienes recibieron una cuenta creada por el administrador o cuando cambia la política.
router.post(
  '/consentimiento',
  authenticate,
  validateBody(z.object({ acepta: z.literal(true, 'Debes aceptar la política para continuar.') })),
  async (req, res) => {
    await registrarConsentimiento(pool, req.auth.usuario.id, req.ip);
    res.json(await getSessionPayload(pool, req.auth.usuario.id));
  }
);

// Latido del frontend mientras el usuario interactúa con la página.
// `authenticate` ya renovó la actividad de la sesión.
router.post('/actividad', authenticate, (_req, res) => {
  res.status(204).end();
});

export default router;
