// Error de negocio que el manejador global traduce a una respuesta JSON.
// `codigo` es estable y lo usa el frontend; `mensaje` se muestra al usuario.
export class AppError extends Error {
  constructor(status, codigo, mensaje, campos) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

export const notFound = (mensaje = 'No encontramos lo que buscas.') =>
  new AppError(404, 'NO_ENCONTRADO', mensaje);

// Código de PostgreSQL para violación de restricción UNIQUE.
export const PG_UNIQUE_VIOLATION = '23505';
