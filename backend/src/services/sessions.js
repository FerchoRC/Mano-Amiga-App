import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { formatNit } from '../lib/nit.js';
import { permisosDe } from '../lib/roles.js';
import { generateToken, hashToken } from '../lib/tokens.js';

// Abre una sesión nueva y devuelve el token en claro (solo se entrega una vez).
export async function createSession(db, idUsuario) {
  const token = generateToken();
  await db.query('INSERT INTO sesion (id_usuario, token_hash) VALUES ($1, $2)', [
    idUsuario,
    hashToken(token),
  ]);
  await db.query('UPDATE usuario SET ultimo_acceso = now() WHERE id_usuario = $1', [idUsuario]);
  return token;
}

export async function closeSession(idSesion) {
  await pool.query('UPDATE sesion SET cerrada_en = now() WHERE id_sesion = $1', [idSesion]);
}

// Cierra las sesiones abiertas del usuario, salvo `exceptoSesion` si se indica.
export async function closeAllSessions(db, idUsuario, exceptoSesion = null) {
  await db.query(
    `UPDATE sesion SET cerrada_en = now()
      WHERE id_usuario = $1 AND cerrada_en IS NULL
        AND ($2::uuid IS NULL OR id_sesion <> $2::uuid)`,
    [idUsuario, exceptoSesion]
  );
}

export function toEmpresaDto(row) {
  return {
    id: row.id_empresa,
    nit: formatNit(row.nit, row.digito_verificacion),
    razonSocial: row.razon_social,
    sector: row.sector,
    numEmpleados: row.num_empleados,
    creadoEn: row.creado_en,
  };
}

// Lo que el frontend necesita para pintar la sesión: usuario, empresa y permisos.
export async function getSessionPayload(db, idUsuario) {
  const { rows } = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.debe_cambiar_contrasena,
            e.id_empresa, e.nit, e.digito_verificacion, e.razon_social, e.sector,
            e.num_empleados, e.creado_en
       FROM usuario u
       JOIN empresa e USING (id_empresa)
      WHERE u.id_usuario = $1`,
    [idUsuario]
  );
  const row = rows[0];

  return {
    usuario: {
      id: row.id_usuario,
      nombre: row.nombre,
      correo: row.correo,
      rol: row.rol,
      debeCambiarContrasena: row.debe_cambiar_contrasena,
    },
    empresa: toEmpresaDto(row),
    permisos: permisosDe(row.rol),
    sesion: { inactividadMinutos: env.sessionIdleMinutes },
  };
}
