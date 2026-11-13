import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../config/db.js';
import { AppError, PG_UNIQUE_VIOLATION, notFound } from '../lib/errors.js';
import { hashPassword } from '../lib/passwords.js';
import { PERMISOS } from '../lib/roles.js';
import {
  contrasenaSchema,
  correoSchema,
  nombreSchema,
  rolSchema,
  uuidSchema,
  validateBody,
} from '../lib/validation.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { enviarInvitacion } from '../services/mailer.js';
import { issueInvitation } from '../services/invitations.js';
import { findSede } from '../services/sedes.js';
import { closeAllSessions } from '../services/sessions.js';

// HU-09: sede a la que pertenece la persona; recibe las alertas de esa sede.
// null = sin sede (recibe las alertas de todas).
const sedeIdSchema = z.uuid('Elige una sede válida.').nullable().optional();

const invitacionSchema = z.object({
  nombre: nombreSchema,
  correo: correoSchema,
  rol: rolSchema,
  sedeId: sedeIdSchema,
});

const crearSchema = z.object({
  nombre: nombreSchema,
  correo: correoSchema,
  rol: rolSchema,
  sedeId: sedeIdSchema,
  contrasena: contrasenaSchema,
  debeCambiarContrasena: z.boolean().default(true),
});

const contrasenaAdminSchema = z.object({
  contrasena: contrasenaSchema,
  debeCambiarContrasena: z.boolean().default(true),
});

const cambioSchema = z
  .object({ rol: rolSchema.optional(), activo: z.boolean().optional(), sedeId: sedeIdSchema })
  .refine(
    (datos) => datos.rol !== undefined || datos.activo !== undefined || datos.sedeId !== undefined,
    { message: 'Indica el rol, el estado o la sede a cambiar.' }
  );

const COLUMNAS_USUARIO = `
  u.id_usuario, u.nombre, u.correo, u.rol, u.activo, u.ultimo_acceso, u.creado_en,
  u.contrasena_hash IS NULL AS pendiente, u.debe_cambiar_contrasena,
  u.id_sede, sd.nombre AS sede_nombre,
  i.expira_en AS invitacion_expira_en`;

const JOINS_USUARIO = `
  LEFT JOIN invitacion i USING (id_usuario)
  LEFT JOIN sede sd ON sd.id_sede = u.id_sede`;

// La sede elegida debe ser de la misma empresa.
async function validarSede(empresaId, sedeId) {
  if (sedeId) await findSede(pool, empresaId, sedeId);
  return sedeId ?? null;
}

function toUsuarioDto(row) {
  return {
    id: row.id_usuario,
    nombre: row.nombre,
    correo: row.correo,
    rol: row.rol,
    estado: row.pendiente ? 'pendiente' : row.activo ? 'activo' : 'inactivo',
    contrasenaTemporal: row.debe_cambiar_contrasena,
    sede: row.id_sede ? { id: row.id_sede, nombre: row.sede_nombre } : null,
    ultimoAcceso: row.ultimo_acceso,
    creadoEn: row.creado_en,
    invitacionExpiraEn: row.pendiente ? row.invitacion_expira_en : null,
  };
}

// Solo encuentra usuarios de la empresa de quien hace la petición.
async function findUsuario(db, empresaId, idUsuario) {
  if (!uuidSchema.safeParse(idUsuario).success) throw notFound('No encontramos a esa persona.');

  const { rows } = await db.query(
    `SELECT ${COLUMNAS_USUARIO}
       FROM usuario u
       ${JOINS_USUARIO}
      WHERE u.id_empresa = $1 AND u.id_usuario = $2`,
    [empresaId, idUsuario]
  );
  if (!rows[0]) throw notFound('No encontramos a esa persona.');
  return rows[0];
}

async function notificarInvitacion(req, usuario, enlace) {
  const {
    rows: [empresa],
  } = await pool.query('SELECT razon_social FROM empresa WHERE id_empresa = $1', [
    req.auth.usuario.empresaId,
  ]);
  return enviarInvitacion({
    para: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    empresa: empresa.razon_social,
    invitadoPor: req.auth.usuario.nombre,
    enlace,
  });
}

const router = Router();

// HU-03: toda la gestión de usuarios es exclusiva del administrador.
router.use(authenticate, requirePermission(PERMISOS.USUARIOS_GESTIONAR));

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_USUARIO}
       FROM usuario u
       ${JOINS_USUARIO}
      WHERE u.id_empresa = $1
      ORDER BY u.contrasena_hash IS NULL, lower(u.nombre)`,
    [req.auth.usuario.empresaId]
  );
  res.json({ usuarios: rows.map(toUsuarioDto) });
});

const correoEnUso = () => {
  const mensaje = 'Ya existe una cuenta con este correo.';
  return new AppError(409, 'CORREO_EN_USO', mensaje, { correo: mensaje });
};

// El administrador crea la cuenta con una contraseña, sin pasar por invitación.
router.post('/', validateBody(crearSchema), async (req, res) => {
  const { nombre, correo, rol, contrasena, debeCambiarContrasena } = req.body;
  const sedeId = await validarSede(req.auth.usuario.empresaId, req.body.sedeId);
  const hash = await hashPassword(contrasena);

  let creado;
  try {
    ({
      rows: [creado],
    } = await pool.query(
      `INSERT INTO usuario
         (id_empresa, nombre, correo, contrasena_hash, rol, invitado_por, debe_cambiar_contrasena, id_sede)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id_usuario`,
      [req.auth.usuario.empresaId, nombre, correo, hash, rol, req.auth.usuario.id, debeCambiarContrasena, sedeId]
    ));
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION && error.constraint === 'usuario_correo_unico') {
      throw correoEnUso();
    }
    throw error;
  }

  const usuario = await findUsuario(pool, req.auth.usuario.empresaId, creado.id_usuario);
  res.status(201).json({ usuario: toUsuarioDto(usuario) });
});

// Restablecer la contraseña de otra persona (o asignarla a una invitación pendiente).
// Cierra sus sesiones abiertas para que entre con la nueva.
router.post('/:id/contrasena', validateBody(contrasenaAdminSchema), async (req, res) => {
  const { empresaId, id: idActual } = req.auth.usuario;
  const usuario = await findUsuario(pool, empresaId, req.params.id);

  if (usuario.id_usuario === idActual) {
    throw new AppError(
      403,
      'ACCION_SOBRE_SI_MISMO',
      'Para cambiar tu propia contraseña usa la opción de tu cuenta.'
    );
  }

  const hash = await hashPassword(req.body.contrasena);
  const actualizado = await withTransaction(async (db) => {
    await db.query(
      `UPDATE usuario SET contrasena_hash = $3, debe_cambiar_contrasena = $4
        WHERE id_empresa = $1 AND id_usuario = $2`,
      [empresaId, usuario.id_usuario, hash, req.body.debeCambiarContrasena]
    );
    await db.query('DELETE FROM invitacion WHERE id_usuario = $1', [usuario.id_usuario]);
    await closeAllSessions(db, usuario.id_usuario);
    return findUsuario(db, empresaId, usuario.id_usuario);
  });

  res.json({ usuario: toUsuarioDto(actualizado) });
});

router.post('/invitaciones', validateBody(invitacionSchema), async (req, res) => {
  const { nombre, correo, rol } = req.body;
  const sedeId = await validarSede(req.auth.usuario.empresaId, req.body.sedeId);

  let resultado;
  try {
    resultado = await withTransaction(async (db) => {
      const {
        rows: [nuevo],
      } = await db.query(
        `INSERT INTO usuario (id_empresa, nombre, correo, rol, invitado_por, id_sede)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_usuario`,
        [req.auth.usuario.empresaId, nombre, correo, rol, req.auth.usuario.id, sedeId]
      );
      const { enlace } = await issueInvitation(db, nuevo.id_usuario);
      const usuario = await findUsuario(db, req.auth.usuario.empresaId, nuevo.id_usuario);
      return { usuario, enlace };
    });
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION && error.constraint === 'usuario_correo_unico') {
      throw correoEnUso();
    }
    throw error;
  }

  const correoEnviado = await notificarInvitacion(req, resultado.usuario, resultado.enlace);
  res.status(201).json({
    usuario: toUsuarioDto(resultado.usuario),
    enlace: resultado.enlace,
    correoEnviado,
  });
});

// Genera un enlace nuevo (el anterior deja de funcionar) y reenvía el correo.
router.post('/:id/invitacion', async (req, res) => {
  const usuario = await findUsuario(pool, req.auth.usuario.empresaId, req.params.id);
  if (!usuario.pendiente) {
    throw new AppError(409, 'INVITACION_ACEPTADA', 'Esta persona ya activó su cuenta.');
  }

  const { enlace } = await issueInvitation(pool, usuario.id_usuario);
  const correoEnviado = await notificarInvitacion(req, usuario, enlace);
  const actualizado = await findUsuario(pool, req.auth.usuario.empresaId, usuario.id_usuario);

  res.json({ usuario: toUsuarioDto(actualizado), enlace, correoEnviado });
});

// Cambiar el rol, la sede o activar/desactivar. Desactivar cierra sus sesiones al instante.
router.patch('/:id', validateBody(cambioSchema), async (req, res) => {
  const { rol, activo } = req.body;
  const { empresaId, id: idActual } = req.auth.usuario;

  const usuario = await findUsuario(pool, empresaId, req.params.id);
  const cambiaSede = req.body.sedeId !== undefined;
  const sedeId = cambiaSede ? await validarSede(empresaId, req.body.sedeId) : null;

  // La propia sede sí se puede cambiar; el propio rol o estado, no.
  if (usuario.id_usuario === idActual && (rol !== undefined || activo !== undefined)) {
    throw new AppError(
      403,
      'ACCION_SOBRE_SI_MISMO',
      'No puedes cambiar tu propio rol ni desactivar tu cuenta. Pídeselo a otro administrador.'
    );
  }
  if (activo !== undefined && usuario.pendiente) {
    throw new AppError(
      409,
      'INVITACION_PENDIENTE',
      'Esta persona aún no ha aceptado su invitación. Si ya no debe entrar, cancela la invitación.'
    );
  }

  const actualizado = await withTransaction(async (db) => {
    await db.query(
      `UPDATE usuario
          SET rol     = COALESCE($3, rol),
              activo  = COALESCE($4, activo),
              id_sede = CASE WHEN $5 THEN $6::uuid ELSE id_sede END
        WHERE id_empresa = $1 AND id_usuario = $2`,
      [empresaId, usuario.id_usuario, rol ?? null, activo ?? null, cambiaSede, sedeId]
    );
    if (activo === false) await closeAllSessions(db, usuario.id_usuario);
    return findUsuario(db, empresaId, usuario.id_usuario);
  });

  res.json({ usuario: toUsuarioDto(actualizado) });
});

// Solo se eliminan invitaciones sin aceptar; a quien ya entró se le desactiva.
router.delete('/:id', async (req, res) => {
  const usuario = await findUsuario(pool, req.auth.usuario.empresaId, req.params.id);
  if (!usuario.pendiente) {
    throw new AppError(
      409,
      'SOLO_INVITACIONES',
      'Solo puedes cancelar invitaciones pendientes. Para quitarle el acceso, desactiva a la persona.'
    );
  }

  await pool.query('DELETE FROM usuario WHERE id_empresa = $1 AND id_usuario = $2', [
    req.auth.usuario.empresaId,
    usuario.id_usuario,
  ]);
  res.status(204).end();
});

export default router;
