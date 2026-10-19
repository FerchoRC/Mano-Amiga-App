import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { testDatabaseConnection } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import empresasRoutes from './routes/empresas.routes.js';
import invitacionesRoutes from './routes/invitaciones.routes.js';
import planesRoutes from './routes/planes.routes.js';
import sedesRoutes from './routes/sedes.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';

export function createApp() {
  const app = express();

  // Render y Vercel ponen un proxy delante; así el rate limit ve la IP real.
  if (env.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    const dbConnected = await testDatabaseConnection();
    res.status(200).json({
      ok: true,
      service: 'mano-amiga-backend',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/empresas', empresasRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/invitaciones', invitacionesRoutes);
  app.use('/api/sedes/:idSede/plan', planesRoutes);
  app.use('/api/sedes', sedesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
