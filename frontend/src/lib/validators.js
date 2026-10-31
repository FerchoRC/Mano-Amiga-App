// Mismas reglas que el backend (backend/src/lib/validation.js), para avisar
// antes de enviar. El backend sigue siendo quien decide.

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarCorreo(valor) {
  if (!valor.trim()) return 'Escribe el correo.';
  if (!CORREO.test(valor.trim())) return 'Escribe un correo válido.';
  return null;
}

export function validarNombre(valor) {
  if (valor.trim().length < 2) return 'Escribe el nombre completo.';
  return null;
}

export function reglasContrasena(valor) {
  return [
    { id: 'largo', texto: '8 caracteres o más', cumple: valor.length >= 8 },
    { id: 'letra', texto: 'Una letra', cumple: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(valor) },
    { id: 'numero', texto: 'Un número', cumple: /\d/.test(valor) },
  ];
}

export function validarContrasena(valor) {
  if (!valor) return 'Escribe una contraseña.';
  if (valor.length > 72) return 'La contraseña es demasiado larga.';
  if (!reglasContrasena(valor).every((regla) => regla.cumple)) {
    return 'La contraseña no cumple los requisitos.';
  }
  return null;
}

// Quita las entradas sin error para saber si un formulario es válido.
export function limpiarErrores(errores) {
  return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}
