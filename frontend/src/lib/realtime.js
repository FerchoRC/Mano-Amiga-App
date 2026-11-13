import { tokenStore } from './api.js';

// Cliente WebSocket para tiempo real (alertas, respuestas de emergencia y cambios del mapa).
// El token no va en la URL: se envía en el primer mensaje y el servidor lo valida
// como en la API. Las salas se vuelven a pedir después de cada reconexión.
class RealtimeClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map(); // evento -> Set<callback>
    this.rooms = new Set();
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.autenticado = false;
    this.detenido = false;
  }

  connect() {
    this.detenido = false;
    const token = tokenStore.get();
    if (!token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ action: 'auth', token: tokenStore.get() }));
    };

    this.ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.event === 'authenticated') {
        this.autenticado = true;
        this.reconnectAttempts = 0;
        for (const room of this.rooms) this.send({ action: 'join', room });
        this.emit('connected', {});
        return;
      }
      if (payload.event) this.emit(payload.event, payload.data, payload.room);
    };

    this.ws.onclose = (event) => {
      this.autenticado = false;
      this.ws = null;
      this.emit('disconnected', {});
      // 4401: sesión inválida. La app la cerrará en la próxima petición a la API;
      // reintentar con el mismo token no sirve.
      if (event.code === 4401 || this.detenido) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimeout || this.detenido) return;
    const delay = Math.min(1000 * 1.5 ** this.reconnectAttempts, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  join(room) {
    if (!room) return;
    this.rooms.add(room);
    if (this.autenticado) this.send({ action: 'join', room });
  }

  leave(room) {
    if (!room) return;
    this.rooms.delete(room);
    if (this.autenticado) this.send({ action: 'leave', room });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, data, room) {
    for (const cb of this.listeners.get(event) ?? []) {
      try {
        cb(data, room);
      } catch (err) {
        console.error(`Error en listener de evento ${event}:`, err);
      }
    }
  }

  // Al cerrar sesión: se corta la conexión y no se reconecta hasta un nuevo connect().
  disconnect() {
    this.detenido = true;
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.rooms.clear();
    this.autenticado = false;
    this.ws?.close();
    this.ws = null;
  }
}

export const realtime = new RealtimeClient();
