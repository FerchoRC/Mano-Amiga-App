import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://manoamiga:manoamiga@localhost:5432/manoamiga',
  // URL pública del frontend: se usa para armar los enlaces de invitación.
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
