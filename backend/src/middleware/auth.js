import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { permisosDe, tienePermiso } from '../lib/roles.js';
import { hashToken } from '../lib/tokens.js';

const sinSesion = () => new AppError(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');

// Lo único que puede hacer alguien con contraseña temporal antes de cambiarla.
const RUTAS_CON_CONTRASENA_TEMPORAL = new Set([
  '/api/auth/sesion',
  '/api/auth/contrasena',
  '/api/auth/logout',
  '/api/auth/actividad',
]);

// Valida el token Bearer contra la tabla de sesiones y registra la actividad.
// HU-02: si pasó el tiempo de inactividad, la sesión se cierra y se responde 401.
export async function authenticate(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw sinSesion();

  const { rows } = await pool.query(
    `SELECT s.id_sesion,
            s.cerrada_en IS NOT NULL                                     AS cerrada,
            now() - s.ultima_actividad > make_interval(mins => $2)       AS inactiva,
            now() - s.creado_en        > make_interval(hours => $3)      AS vencida,
            u.id_usuario, u.id_empresa, u.nombre, u.correo, u.rol, u.activo,
            u.debe_cambiar_contrasena
       FROM sesion s
       JOIN usuario u USING (id_usuario)
      WHERE s.token_hash = $1`,
    [hashToken(token), env.sessionIdleMinutes, env.sessionMaxHours]
  );
  const sesion = rows[0];

  if (!sesion || sesion.cerrada) throw sinSesion();

  if (sesion.inactiva || sesion.vencida || !sesion.activo) {
    await pool.query('UPDATE sesion SET cerrada_en = now() WHERE id_sesion = $1', [
      sesion.id_sesion,
    ]);
    if (!sesion.activo) {
      throw new AppError(401, 'USUARIO_INACTIVO', 'Tu cuenta fue desactivada por el administrador.');
    }
    throw new AppError(
      401,
      'SESION_EXPIRADA',
      sesion.inactiva
        ? 'Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.'
        : 'Tu sesión venció. Vuelve a iniciar sesión.'
    );
  }

  await pool.query('UPDATE sesion SET ultima_actividad = now() WHERE id_sesion = $1', [
    sesion.id_sesion,
  ]);

  if (
    sesion.debe_cambiar_contrasena &&
    !RUTAS_CON_CONTRASENA_TEMPORAL.has(req.originalUrl.split('?')[0])
  ) {
    throw new AppError(
      403,
      'CAMBIO_CONTRASENA_REQUERIDO',
      'Debes crear tu propia contraseña antes de continuar.'
    );
  }

  req.auth = {
    sesionId: sesion.id_sesion,
    usuario: {
      id: sesion.id_usuario,
      empresaId: sesion.id_empresa,
      nombre: sesion.nombre,
      correo: sesion.correo,
      rol: sesion.rol,
    },
    permisos: permisosDe(sesion.rol),
  };
  next();
}

export function requirePermission(permiso) {
  return (req, _res, next) => {
    if (!tienePermiso(req.auth?.usuario.rol, permiso)) {
      throw new AppError(403, 'SIN_PERMISO', 'Tu rol no tiene acceso a esta sección.');
    }
    next();
  };
}
