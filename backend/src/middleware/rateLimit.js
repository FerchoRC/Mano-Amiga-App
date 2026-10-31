import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';

function limiter({ windowMinutes, limit, mensaje, ...opciones }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { error: { codigo: 'DEMASIADOS_INTENTOS', mensaje } },
    ...opciones,
  });
}

// Frena ataques de fuerza bruta contra el inicio de sesión. Solo cuentan los
// intentos fallidos: en una empresa muchos empleados comparten la misma IP.
export const loginLimiter = limiter({
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.',
});

// Protege la cuota del servicio de mapas (Nominatim) compartida por todos.
export const geocodingLimiter = limiter({
  windowMinutes: 1,
  limit: 20,
  mensaje: 'Hiciste muchas búsquedas seguidas. Espera un momento o ubica la sede en el mapa.',
});

export const publicLimiter = limiter({
  windowMinutes: 15,
  limit: 100,
  mensaje: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.',
});
