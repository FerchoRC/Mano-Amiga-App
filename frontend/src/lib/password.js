// Contraseña aleatoria fácil de dictar (sin caracteres ambiguos como l, 1, O, 0)
// y que cumple las reglas del backend: p. ej. "kHtw-4827-RmPa".
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITOS = '23456789';

function bloque(alfabeto, largo) {
  const valores = crypto.getRandomValues(new Uint32Array(largo));
  return Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join('');
}

export function generarContrasena() {
  return `${bloque(LETRAS, 4)}-${bloque(DIGITOS, 4)}-${bloque(LETRAS, 4)}`;
}
