import { createApp } from './app.js';
import { testDatabaseConnection } from './config/db.js';
import { env } from './config/env.js';

const app = createApp();

// Express 5 entrega al callback los errores de arranque (p. ej. puerto ocupado).
app.listen(env.port, async (error) => {
  if (error) {
    console.error(`✖ No se pudo iniciar la API en el puerto ${env.port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`🚀 API de Mano Amiga disponible en http://localhost:${env.port}`);
  await testDatabaseConnection();
});
