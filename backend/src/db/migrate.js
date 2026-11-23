import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { pool } from '../config/db.js';

// Número arbitrario para el candado de PostgreSQL: si dos procesos arrancan a la vez
// (dos instancias, o el servidor y `npm run db:migrate`), el segundo espera al primero.
const CANDADO_MIGRACION = 7_204_118;

// El esquema es idempotente (CREATE ... IF NOT EXISTS, ALTER ... IF EXISTS): se puede
// aplicar las veces que sea. El servidor lo aplica al arrancar (src/index.js), así que
// nadie tiene que acordarse de correr `npm run db:migrate` tras bajar cambios.
export async function migrate() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [CANDADO_MIGRACION]);
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [CANDADO_MIGRACION]).catch(() => {});
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate();
    console.log('✔ Esquema de base de datos actualizado');
  } catch (error) {
    console.error('✖ No se pudo aplicar el esquema:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
