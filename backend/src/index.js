import http from 'node:http';

import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { programarLimpieza } from './services/limpieza.js';
import { closeRealtime, initRealtime } from './services/realtime.js';

// El esquema se aplica antes de recibir peticiones: quien baja cambios con tablas
// nuevas no tiene que acordarse de correr `npm run db:migrate`.
try {
  await migrate();
} catch (error) {
  console.error(`✖ No se pudo preparar la base de datos: ${error.message}`);
  console.error('  ¿Está encendido PostgreSQL? (docker compose up -d en backend/)');
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);

// HU-08 a HU-10: WebSocket para alertas, respuestas y cambios del mapa.
initRealtime(server);
const detenerLimpieza = programarLimpieza();

server.listen(env.port, (error) => {
  if (error) {
    console.error(`✖ No se pudo iniciar la API en el puerto ${env.port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`🚀 API de Mano Amiga disponible en http://localhost:${env.port}`);
});

// Apagado ordenado: el proveedor envía SIGTERM al desplegar una versión nueva. Se dejan
// de aceptar conexiones, se terminan las peticiones en curso y se cierra la base.
let apagando = false;
async function apagar(senal) {
  if (apagando) return;
  apagando = true;
  console.log(`${senal} recibido: cerrando la API…`);
  const forzar = setTimeout(() => process.exit(1), 10_000);
  forzar.unref();
  detenerLimpieza();
  closeRealtime();
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
