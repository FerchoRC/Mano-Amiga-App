// Tiempo real por WebSocket (/ws) para alertas (HU-09, HU-10) y cambios del mapa (HU-08).
//
// Seguridad:
// - El token no viaja en la URL: el cliente lo envía en su primer mensaje ({ action: 'auth' }).
//   Se valida igual que en la API (sesión abierta, sin inactividad, usuario activo).
// - Cada conexión solo entra a salas de su propia empresa, y a la sala de una alerta
//   únicamente si puede ver sus respuestas (administrador o brigadista).
// - Las sesiones se revisan periódicamente: si se cierran o vencen, la conexión se corta.
import { WebSocket, WebSocketServer } from 'ws';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { PERMISOS, tienePermiso } from '../lib/roles.js';
import { hashToken } from '../lib/tokens.js';
import { uuidSchema } from '../lib/validation.js';

const TIEMPO_PARA_AUTENTICAR_MS = 10_000;
const LATIDO_MS = 30_000;
const REVISION_SESION_MS = 60_000;

const salas = new Map(); // nombre de sala -> Set<WebSocket>
let servidor = null;
let temporizadores = [];

async function usuarioDeToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const { rows } = await pool.query(
    `SELECT u.id_usuario, u.id_empresa, u.nombre, u.rol, u.id_sede
       FROM sesion s
       JOIN usuario u USING (id_usuario)
      WHERE s.token_hash = $1
        AND s.cerrada_en IS NULL
        AND u.activo
        AND NOT u.debe_cambiar_contrasena
        AND now() - s.ultima_actividad <= make_interval(mins => $2)
        AND now() - s.creado_en <= make_interval(hours => $3)`,
    [hashToken(token), env.sessionIdleMinutes, env.sessionMaxHours]
  );
  const u = rows[0];
  return u
    ? { id: u.id_usuario, empresaId: u.id_empresa, nombre: u.nombre, rol: u.rol, sedeId: u.id_sede }
    : null;
}

function enviar(ws, event, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }
}

function unir(sala, ws) {
  if (!salas.has(sala)) salas.set(sala, new Set());
  salas.get(sala).add(ws);
  ws.salas.add(sala);
}

function salir(sala, ws) {
  salas.get(sala)?.delete(ws);
  if (salas.get(sala)?.size === 0) salas.delete(sala);
  ws.salas.delete(sala);
}

function salirDeTodas(ws) {
  for (const sala of [...ws.salas]) salir(sala, ws);
}

// ¿Puede este usuario entrar a la sala? Solo salas de su propia empresa.
async function puedeEntrar(usuario, sala) {
  const [tipo, id] = String(sala).split(':');
  if (!uuidSchema.safeParse(id).success) return false;

  if (tipo === 'empresa') return id === usuario.empresaId;

  if (tipo === 'sede') {
    const { rowCount } = await pool.query('SELECT 1 FROM sede WHERE id_sede = $1 AND id_empresa = $2', [
      id,
      usuario.empresaId,
    ]);
    return rowCount > 0;
  }

  if (tipo === 'alerta') {
    if (!tienePermiso(usuario.rol, PERMISOS.ALERTAS_ENVIAR)) return false;
    const { rowCount } = await pool.query(
      'SELECT 1 FROM alerta WHERE id_alerta = $1 AND id_empresa = $2',
      [id, usuario.empresaId]
    );
    return rowCount > 0;
  }

  return false;
}

async function alRecibir(ws, mensaje) {
  let datos;
  try {
    datos = JSON.parse(mensaje.toString());
  } catch {
    return;
  }
  const { action, room, token } = datos ?? {};

  if (action === 'auth') {
    const usuario = await usuarioDeToken(token);
    if (!usuario) {
      enviar(ws, 'error', { codigo: 'NO_AUTENTICADO', mensaje: 'Tu sesión no es válida.' });
      ws.close(4401, 'No autenticado');
      return;
    }
    salirDeTodas(ws);
    ws.token = token;
    ws.usuario = usuario;
    clearTimeout(ws.limiteAutenticacion);
    unir(`empresa:${usuario.empresaId}`, ws);
    enviar(ws, 'authenticated', { usuario: { id: usuario.id, rol: usuario.rol } });
    return;
  }

  if (action === 'ping') {
    enviar(ws, 'pong');
    return;
  }

  if (!ws.usuario) {
    enviar(ws, 'error', { codigo: 'NO_AUTENTICADO', mensaje: 'Primero autentícate.' });
    return;
  }

  if (action === 'join' && room) {
    if (await puedeEntrar(ws.usuario, room)) {
      unir(room, ws);
      enviar(ws, 'joined', { room });
    } else {
      enviar(ws, 'error', { codigo: 'SIN_PERMISO', mensaje: 'No tienes acceso a esa sala.', room });
    }
  } else if (action === 'leave' && room) {
    salir(room, ws);
    enviar(ws, 'left', { room });
  }
}

function emitir(sala, event, data = {}) {
  const clientes = salas.get(sala);
  if (!clientes) return;
  const payload = JSON.stringify({ event, room: sala, data, timestamp: new Date().toISOString() });
  for (const ws of clientes) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

// Los eventos de empresa llegan a todas sus personas: deben llevar solo
// identificadores; cada cliente vuelve a pedir a la API lo que le corresponde.
export const realtime = {
  toEmpresa: (empresaId, event, data) => emitir(`empresa:${empresaId}`, event, data),
  toSede: (sedeId, event, data) => emitir(`sede:${sedeId}`, event, data),
  toAlerta: (alertaId, event, data) => emitir(`alerta:${alertaId}`, event, data),
};

export function initRealtime(server) {
  servidor = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

  servidor.on('connection', (ws) => {
    ws.salas = new Set();
    ws.vivo = true;
    ws.on('pong', () => {
      ws.vivo = true;
    });
    ws.limiteAutenticacion = setTimeout(() => {
      if (!ws.usuario) ws.close(4401, 'No autenticado');
    }, TIEMPO_PARA_AUTENTICAR_MS);

    ws.on('message', (mensaje) => {
      alRecibir(ws, mensaje).catch((error) => console.error('[tiempo real]', error.message));
    });
    ws.on('close', () => {
      clearTimeout(ws.limiteAutenticacion);
      salirDeTodas(ws);
    });
  });

  // Cierra conexiones caídas (sin respuesta al ping).
  const latido = setInterval(() => {
    for (const ws of servidor.clients) {
      if (!ws.vivo) {
        ws.terminate();
        continue;
      }
      ws.vivo = false;
      ws.ping();
    }
  }, LATIDO_MS);

  // Corta las conexiones cuya sesión se cerró, venció o cuyo usuario fue desactivado.
  const revision = setInterval(async () => {
    for (const ws of servidor.clients) {
      if (!ws.usuario) continue;
      try {
        if (!(await usuarioDeToken(ws.token))) {
          enviar(ws, 'sesion:cerrada');
          ws.close(4401, 'Sesión cerrada');
        }
      } catch (error) {
        console.error('[tiempo real]', error.message);
      }
    }
  }, REVISION_SESION_MS);

  temporizadores = [latido, revision];
  return servidor;
}

export function closeRealtime() {
  temporizadores.forEach(clearInterval);
  for (const ws of servidor?.clients ?? []) ws.terminate();
  servidor?.close();
  salas.clear();
}
