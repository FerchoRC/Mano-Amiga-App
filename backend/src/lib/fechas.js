// Fechas de calendario ('YYYY-MM-DD') en la hora de Colombia (UTC-5, sin horario de verano).
// Las columnas DATE llegan como texto (config/db.js), así que se comparan como cadenas.

const DIA_MS = 24 * 3600 * 1000;

export function hoyEnColombia(ahora = Date.now()) {
  return new Date(ahora - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// '2026-03-12' → '12 mar 2026'
export function fechaCorta(fecha) {
  if (!fecha) return '';
  const [a, m, d] = fecha.split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`;
}
