import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// Formato almacenado: scrypt$<sal en base64>$<clave en base64>
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algoritmo, salt, key] = String(stored ?? '').split('$');
  if (algoritmo !== 'scrypt' || !salt || !key) return false;

  const esperada = Buffer.from(key, 'base64');
  const calculada = await scryptAsync(password, Buffer.from(salt, 'base64'), esperada.length);
  return timingSafeEqual(esperada, calculada);
}

// Hash de relleno para comparar aunque el correo no exista, de modo que el
// tiempo de respuesta no revele si una cuenta está registrada (HU-02).
let dummyHash;
export async function verifyAgainstDummy(password) {
  dummyHash ??= await hashPassword('manoamiga-relleno');
  await verifyPassword(password, dummyHash);
  return false;
}
