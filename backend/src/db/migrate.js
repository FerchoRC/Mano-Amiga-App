import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { pool } from '../config/db.js';

export async function migrate() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
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
