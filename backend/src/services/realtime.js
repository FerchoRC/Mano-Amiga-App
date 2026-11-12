import { WebSocket, WebSocketServer } from 'ws';

import { pool } from '../config/db.js';
import { hashToken } from '../lib/tokens.js';

let wss = null;
const rooms = new Map(); // roomName -> Set<WebSocket>

/**
 * Autentica una conexión de WebSocket usando el token de sesión.
 */
async function authenticateToken(token) {
  if (!token) return null;
  try {
    const { rows } = await pool.query(
      `SELECT s.id_sesion, u.id_usuario, u.id_empresa, u.nombre, u.correo, u.rol
         FROM sesion s
         JOIN usuario u USING (id_usuario)
        WHERE s.token_hash = $1 AND s.cerrada_en IS NULL`,
      [hashToken(token)]
    );
    if (!rows[0]) return null;
    return {
      sesionId: rows[0].id_sesion,
      usuarioId: rows[0].id_usuario,
      empresaId: rows[0].id_empresa,
      nombre: rows[0].nombre,
      correo: rows[0].correo,
      rol: rows[0].rol,
    };
  } catch (err) {
    console.error('Error al autenticar WebSocket:', err.message);
    return null;
  }
}

/**
 * Une una conexión a una sala.
 */
export function joinRoom(room, ws) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(ws);
  if (!ws.rooms) ws.rooms = new Set();
  ws.rooms.add(room);
}

/**
 * Remueve una conexión de una sala.
 */
export function leaveRoom(room, ws) {
  if (rooms.has(room)) {
    rooms.get(room).delete(ws);
    if (rooms.get(room).size === 0) {
      rooms.delete(room);
    }
  }
  if (ws.rooms) ws.rooms.delete(room);
}

/**
 * Envía un mensaje JSON a una conexión WebSocket.
 */
export function sendTo(ws, event, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }
}

/**
 * Emite un evento a todos los clientes suscritos a una sala.
 */
export function broadcastToRoom(room, event, data = {}) {
  const clients = rooms.get(room);
  if (!clients) return;
  const payload = JSON.stringify({ event, room, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * Emite a nivel de empresa o sede o alerta específica.
 */
export const realtime = {
  toEmpresa(empresaId, event, data) {
    broadcastToRoom(`empresa:${empresaId}`, event, data);
  },
  toSede(sedeId, event, data) {
    broadcastToRoom(`sede:${sedeId}`, event, data);
  },
  toAlerta(alertaId, event, data) {
    broadcastToRoom(`alerta:${alertaId}`, event, data);
  },
  broadcast: broadcastToRoom,
};

/**
 * Inicializa el servidor WebSocket montado sobre el servidor HTTP existente.
 */
export function initRealtime(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let authUser = await authenticateToken(token);

    if (authUser) {
      ws.user = authUser;
      joinRoom(`empresa:${authUser.empresaId}`, ws);
      sendTo(ws, 'authenticated', { user: authUser });
    }

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        const { action, room, token: msgToken } = payload;

        if (action === 'auth') {
          const user = await authenticateToken(msgToken);
          if (user) {
            ws.user = user;
            joinRoom(`empresa:${user.empresaId}`, ws);
            sendTo(ws, 'authenticated', { user });
          } else {
            sendTo(ws, 'error', { message: 'Token inválido' });
          }
          return;
        }

        if (action === 'join' && room) {
          joinRoom(room, ws);
          sendTo(ws, 'joined', { room });
        } else if (action === 'leave' && room) {
          leaveRoom(room, ws);
          sendTo(ws, 'left', { room });
        } else if (action === 'ping') {
          sendTo(ws, 'pong', {});
        }
      } catch (err) {
        // Ignorar mensajes mal formateados
      }
    });

    ws.on('close', () => {
      if (ws.rooms) {
        for (const room of ws.rooms) {
          leaveRoom(room, ws);
        }
      }
    });
  });

  return wss;
}
