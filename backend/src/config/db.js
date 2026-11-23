import pg from 'pg';

import { env } from './env.js';

const { Pool, types } = pg;

// Las columnas DATE (p. ej. el vencimiento de un equipo) se leen como 'AAAA-MM-DD'.
// Convertirlas a Date las movería un día según la zona horaria del servidor.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const SSL = {
  verificar: { rejectUnauthorized: true },
  'sin-verificar': { rejectUnauthorized: false },
  no: false,
};

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: SSL[env.databaseSsl],
});

// Si se cae una conexión que estaba libre (reinicio de la base o de la red), pg emite
// 'error' en el pool. Sin este manejador Node lo trata como no capturado y se cierra.
// El pool descarta esa conexión y abre otra en la siguiente consulta.
pool.on('error', (error) => {
  console.error('[db] Se perdió una conexión inactiva con la base:', error.message);
});

export async function testDatabaseConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    return false;
  }
}

// Ejecuta `fn` dentro de una transacción y libera el cliente pase lo que pase.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
