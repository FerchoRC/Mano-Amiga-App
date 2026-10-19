const LOCALE = 'es-CO';

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes.at(-1)[0] : (partes[0] ?? '?').slice(0, 2);
  return letras.toUpperCase();
}

export const primerNombre = (nombre = '') => nombre.trim().split(/\s+/)[0] ?? '';

export function saludo(fecha = new Date()) {
  const hora = fecha.getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function fechaLarga(fecha = new Date()) {
  const texto = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(fecha));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fechaCorta(fecha) {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(fecha))
    .replace('.', '');
}

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const UNIDADES = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function tiempoRelativo(fecha) {
  if (!fecha) return null;
  const segundos = (new Date(fecha).getTime() - Date.now()) / 1000;
  if (Math.abs(segundos) < 60) return 'Hace un momento';

  for (const [unidad, duracion] of UNIDADES) {
    if (Math.abs(segundos) >= duracion) {
      const texto = relativo.format(Math.round(segundos / duracion), unidad);
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
  }
  return null;
}

export const formatearNumero = (n) => new Intl.NumberFormat(LOCALE).format(n);
