// Validación del NIT colombiano con el dígito de verificación de la DIAN.
// Una persona jurídica tiene NIT de 9 dígitos más 1 dígito de verificación.

const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41];

export function calcularDigitoVerificacion(base) {
  const digitos = String(base).split('').reverse();
  const suma = digitos.reduce((total, digito, i) => total + Number(digito) * PESOS[i], 0);
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

// Acepta "900.123.456-8", "900123456-8" o "9001234568".
// Devuelve { base, dv } si el NIT es válido, o null.
export function parseNit(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.length !== 10) return null;

  const base = digitos.slice(0, 9);
  const dv = Number(digitos[9]);
  if (/^0/.test(base) || calcularDigitoVerificacion(base) !== dv) return null;

  return { base, dv };
}

export function formatNit(base, dv) {
  return `${base.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}
