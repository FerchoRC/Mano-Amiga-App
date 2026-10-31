import { z } from 'zod';

import { AppError } from './errors.js';
import { LISTA_ROLES } from './roles.js';

export const correoSchema = z
  .string('Escribe tu correo.')
  .trim()
  .toLowerCase()
  .max(254, 'El correo es demasiado largo.')
  .pipe(z.email('Escribe un correo válido.'));

export const nombreSchema = z
  .string('Escribe el nombre.')
  .trim()
  .min(2, 'Escribe el nombre completo.')
  .max(120, 'El nombre es demasiado largo.');

export const contrasenaSchema = z
  .string('Escribe una contraseña.')
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña es demasiado larga.')
  .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, 'La contraseña debe tener al menos una letra.')
  .regex(/\d/, 'La contraseña debe tener al menos un número.');

export const rolSchema = z.enum(LISTA_ROLES, 'Elige un rol válido.');

export const uuidSchema = z.uuid();

// Valida req.body con un esquema zod y lo reemplaza por la versión limpia.
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const campos = {};
      for (const issue of result.error.issues) {
        const campo = issue.path.join('.') || '_';
        campos[campo] ??= issue.message;
      }
      throw new AppError(400, 'DATOS_INVALIDOS', 'Revisa los datos marcados.', campos);
    }
    req.body = result.data;
    next();
  };
}
