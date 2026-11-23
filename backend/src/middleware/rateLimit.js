import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';

// Contadores en PostgreSQL (tabla limite_intentos): se comparten entre instancias del
// backend y no se pierden con un reinicio o un despliegue, como pasaría en memoria.
export class PostgresStore {
  localKeys = false;

  constructor(prefijo) {
    this.prefix = prefijo;
  }

  init(opciones) {
    this.ventanaMs = opciones.windowMs;
  }

  clave(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const { rows } = await pool.query(
      `INSERT INTO limite_intentos (clave, intentos, reinicia_en)
       VALUES ($1, 1, now() + make_interval(secs => $2))
       ON CONFLICT (clave) DO UPDATE SET
         intentos    = CASE WHEN limite_intentos.reinicia_en <= now() THEN 1
                            ELSE limite_intentos.intentos + 1 END,
         reinicia_en = CASE WHEN limite_intentos.reinicia_en <= now() THEN EXCLUDED.reinicia_en
                            ELSE limite_intentos.reinicia_en END
       RETURNING intentos, reinicia_en`,
      [this.clave(key), this.ventanaMs / 1000]
    );
    return { totalHits: rows[0].intentos, resetTime: rows[0].reinicia_en };
  }

  async decrement(key) {
    await pool.query(
      'UPDATE limite_intentos SET intentos = greatest(intentos - 1, 0) WHERE clave = $1',
      [this.clave(key)]
    );
  }

  async resetKey(key) {
    await pool.query('DELETE FROM limite_intentos WHERE clave = $1', [this.clave(key)]);
  }
}

function limiter({ nombre, windowMinutes, limit, mensaje, ...opciones }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    store: new PostgresStore(nombre),
    message: { error: { codigo: 'DEMASIADOS_INTENTOS', mensaje } },
    ...opciones,
  });
}

const correoDe = (req) => String(req.body?.correo ?? '').trim().toLowerCase().slice(0, 254);

const MENSAJE_LOGIN = 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.';

// Fuerza bruta contra una cuenta: 10 fallos seguidos con el mismo correo desde la misma IP.
// Solo cuentan los fallos. Al ser por correo, los errores de una persona no bloquean al
// resto de la oficina, aunque todos salgan a internet por la misma IP.
const loginPorCuenta = limiter({
  nombre: 'login-cuenta',
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${correoDe(req)}`,
  mensaje: MENSAJE_LOGIN,
});

// Prueba de muchas cuentas desde un mismo lugar: 100 fallos por IP en 15 minutos.
const loginPorIp = limiter({
  nombre: 'login-ip',
  windowMinutes: 15,
  limit: 100,
  skipSuccessfulRequests: true,
  mensaje: MENSAJE_LOGIN,
});

export const loginLimiter = [loginPorIp, loginPorCuenta];

// Solicitudes de recuperación de contraseña: evita usar el formulario para inundar
// de correos a alguien.
export const recuperacionLimiter = limiter({
  nombre: 'recuperacion',
  windowMinutes: 15,
  limit: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${correoDe(req)}`,
  mensaje: 'Ya pediste varios enlaces. Revisa tu correo o espera unos minutos.',
});

// Protege la cuota del servicio de mapas (Nominatim) compartida por todos.
export const geocodingLimiter = limiter({
  nombre: 'geocodificacion',
  windowMinutes: 1,
  limit: 20,
  mensaje: 'Hiciste muchas búsquedas seguidas. Espera un momento o ubica la sede en el mapa.',
});

export const publicLimiter = limiter({
  nombre: 'publico',
  windowMinutes: 15,
  limit: 100,
  mensaje: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.',
});
