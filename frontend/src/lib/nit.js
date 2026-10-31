// Mismo algoritmo de la DIAN que usa el backend (backend/src/lib/nit.js).
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41];

export function calcularDigitoVerificacion(base) {
  const suma = String(base)
    .split('')
    .reverse()
    .reduce((total, digito, i) => total + Number(digito) * PESOS[i], 0);
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

export const soloDigitosNit = (valor) => String(valor ?? '').replace(/\D/g, '').slice(0, 10);

// Formatea mientras se escribe: 9001234568 → 900.123.456-8
export function formatearNit(valor) {
  const digitos = soloDigitosNit(valor);
  const base = digitos.slice(0, 9).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return digitos.length > 9 ? `${base}-${digitos[9]}` : base;
}

// 'incompleto' | 'invalido' | 'valido'
export function estadoNit(valor) {
  const digitos = soloDigitosNit(valor);
  if (digitos.length < 10) return 'incompleto';
  if (digitos[0] === '0') return 'invalido';
  return calcularDigitoVerificacion(digitos.slice(0, 9)) === Number(digitos[9]) ? 'valido' : 'invalido';
}
