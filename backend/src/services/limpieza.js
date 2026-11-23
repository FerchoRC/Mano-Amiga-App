import { pool } from '../config/db.js';

// Registros que ya no sirven para nada: sesiones cerradas o vencidas hace más de 30 días
// (ninguna sesión dura más de SESSION_MAX_HOURS), enlaces de recuperación usados o
// vencidos, y contadores de intentos de inicio de sesión que ya expiraron.
export async function limpiarRegistrosVencidos(db = pool) {
  const sesiones = await db.query(
    `DELETE FROM sesion
      WHERE creado_en < now() - interval '30 days'
         OR cerrada_en < now() - interval '30 days'`
  );
  const recuperaciones = await db.query(
    `DELETE FROM recuperacion
      WHERE expira_en < now() - interval '1 day' OR usado_en < now() - interval '1 day'`
  );
  const intentos = await db.query('DELETE FROM limite_intentos WHERE reinicia_en < now()');
  return {
    sesiones: sesiones.rowCount,
    recuperaciones: recuperaciones.rowCount,
    intentos: intentos.rowCount,
  };
}

const CADA_SEIS_HORAS = 6 * 3600 * 1000;

export function programarLimpieza() {
  const correr = () =>
    limpiarRegistrosVencidos().catch((error) =>
      console.error('[limpieza] No se pudo limpiar:', error.message)
    );
  correr();
  const temporizador = setInterval(correr, CADA_SEIS_HORAS);
  temporizador.unref();
  return () => clearInterval(temporizador);
}
