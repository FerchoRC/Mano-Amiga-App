import http from 'node:http';

import { createApp } from './app.js';
import { testDatabaseConnection } from './config/db.js';
import { env } from './config/env.js';
import { initRealtime } from './services/realtime.js';

const app = createApp();
const server = http.createServer(app);

// HU-10: WebSocket server reutilizable para emergencias y futuros módulos en tiempo real
initRealtime(server);

server.listen(env.port, async (error) => {
  if (error) {
    console.error(`✖ No se pudo iniciar la API en el puerto ${env.port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`🚀 API de Mano Amiga disponible en http://localhost:${env.port}`);
  await testDatabaseConnection();
});
