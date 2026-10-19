import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../lib/errors.js';
import { hashPassword } from '../lib/passwords.js';
import { hashToken } from '../lib/tokens.js';
import { contrasenaSchema, nombreSchema, validateBody } from '../lib/validation.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { createSession, getSessionPayload } from '../services/sessions.js';

const aceptarSchema = z.object({ nombre: nombreSchema, contrasena: contrasenaSchema });

// Busca la invitación por su token y falla con un mensaje claro si no sirve.
async function findInvitacion(db, token, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT i.id_invitacion, i.expira_en < now() AS expirada,
            u.id_usuario, u.nombre, u.correo, u.rol, u.activo,
            e.razon_social, quien.nombre AS invitado_por
       FROM invitacion i
       JOIN usuario u USING (id_usuario)
       JOIN empresa e ON e.id_empresa = u.id_empresa
       LEFT JOIN usuario quien ON quien.id_usuario = u.invitado_por
      WHERE i.token_hash = $1
      ${bloquear ? 'FOR UPDATE OF i' : ''}`,
    [hashToken(token)]
  );
  const invitacion = rows[0];

  if (!invitacion || !invitacion.activo) {
    throw new AppError(
      404,
      'INVITACION_INVALIDA',
      'Este enlace de invitación no es válido o ya se usó.'
    );
  }
  if (invitacion.expirada) {
    throw new AppError(
      410,
      'INVITACION_EXPIRADA',
      'Este enlace venció. Pide al administrador de tu empresa que te envíe uno nuevo.'
    );
  }
  return invitacion;
}

const router = Router();
router.use(publicLimiter);

router.get('/:token', async (req, res) => {
  const invitacion = await findInvitacion(pool, req.params.token);
  res.json({
    invitacion: {
      nombre: invitacion.nombre,
      correo: invitacion.correo,
      rol: invitacion.rol,
      empresa: invitacion.razon_social,
      invitadoPor: invitacion.invitado_por,
    },
  });
});

// La persona invitada crea su contraseña y entra directamente.
router.post('/:token/aceptar', validateBody(aceptarSchema), async (req, res) => {
  const contrasenaHash = await hashPassword(req.body.contrasena);

  const { token, payload } = await withTransaction(async (db) => {
    const invitacion = await findInvitacion(db, req.params.token, { bloquear: true });

    await db.query('UPDATE usuario SET nombre = $2, contrasena_hash = $3 WHERE id_usuario = $1', [
      invitacion.id_usuario,
      req.body.nombre,
      contrasenaHash,
    ]);
    await db.query('DELETE FROM invitacion WHERE id_invitacion = $1', [invitacion.id_invitacion]);

    const token = await createSession(db, invitacion.id_usuario);
    return { token, payload: await getSessionPayload(db, invitacion.id_usuario) };
  });

  res.status(201).json({ token, ...payload });
});

export default router;
