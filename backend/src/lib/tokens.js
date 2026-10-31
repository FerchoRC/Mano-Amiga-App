import { createHash, randomBytes } from 'node:crypto';

// Los tokens viajan al cliente; en la base solo se guarda su hash.
export function generateToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}
