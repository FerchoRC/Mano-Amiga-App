const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'manoamiga.token';

// Códigos con los que el backend indica que la sesión ya no sirve.
export const CODIGOS_SESION_PERDIDA = new Set(['NO_AUTENTICADO', 'SESION_EXPIRADA', 'USUARIO_INACTIVO']);

export const tokenStore = {
  key: TOKEN_KEY,
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* almacenamiento no disponible: la sesión dura lo que dure la pestaña */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada que limpiar */
    }
  },
};

export class ApiError extends Error {
  constructor(status, codigo, mensaje, campos = {}) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos ?? {};
  }
}

let onSessionLost = () => {};
export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'SIN_CONEXION',
      'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta de nuevo.'
    );
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new ApiError(
      res.status,
      data?.error?.codigo ?? 'ERROR',
      data?.error?.mensaje ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      data?.error?.campos
    );
    if (res.status === 401 && token && CODIGOS_SESION_PERDIDA.has(error.codigo)) {
      onSessionLost(error);
    }
    throw error;
  }
  return data;
}
