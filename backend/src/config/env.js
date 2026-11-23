import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// En producción no hay valores por defecto para lo que cambia de un despliegue a otro:
// si falta, el servidor no arranca (antes usaba la base local y enlaces a localhost).
const REQUERIDAS_EN_PRODUCCION = ['DATABASE_URL', 'APP_URL'];
if (isProduction) {
  const faltan = REQUERIDAS_EN_PRODUCCION.filter((nombre) => !process.env[nombre]);
  if (faltan.length) {
    console.error(`✖ Faltan variables de entorno para producción: ${faltan.join(', ')}`);
    process.exit(1);
  }
}

const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

// SSL hacia PostgreSQL: 'verificar' (por defecto en producción) valida el certificado;
// 'sin-verificar' solo para proveedores con certificados propios; 'no' lo desactiva.
const MODOS_SSL = ['verificar', 'sin-verificar', 'no'];
const databaseSsl = process.env.DATABASE_SSL || (isProduction ? 'verificar' : 'no');
if (!MODOS_SSL.includes(databaseSsl)) {
  console.error(`✖ DATABASE_SSL debe ser ${MODOS_SSL.join(', ')} (llegó "${databaseSsl}").`);
  process.exit(1);
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://manoamiga:manoamiga@localhost:5432/manoamiga',
  databaseSsl,
  // URL pública del frontend: se usa para armar los enlaces de invitación y recuperación.
  appUrl,
  corsOrigins: (process.env.CORS_ORIGINS || appUrl).split(',').map((origin) => origin.trim()),
  // HU-02: la sesión se cierra tras este tiempo sin actividad.
  sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES) || 15,
  // Aunque haya actividad, ninguna sesión dura más que esto.
  sessionMaxHours: Number(process.env.SESSION_MAX_HOURS) || 12,
  invitationDays: Number(process.env.INVITATION_DAYS) || 7,
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'ManoAmiga <no-responder@manoamiga.co>',
};
