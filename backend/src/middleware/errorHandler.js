import { AppError } from '../lib/errors.js';

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', 'La ruta solicitada no existe.'));
}

// Respuesta de error uniforme: { error: { codigo, mensaje, campos? } }
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { codigo: err.codigo, mensaje: err.message, campos: err.campos },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' } });
  }

  console.error(err);
  return res
    .status(500)
    .json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } });
}
