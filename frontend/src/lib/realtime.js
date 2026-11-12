import { tokenStore } from './api.js';

// Cliente WebSocket nativo para tiempo real (alertas, respuestas de emergencia y futuras extensiones).
class RealtimeClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map(); // event -> Set<callback>
    this.rooms = new Set();
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 5000;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = tokenStore.get();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Re-suscribir a salas activas
      for (const room of this.rooms) {
        this.send({ action: 'join', room });
      }
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event) {
          this.emit(payload.event, payload.data, payload.room);
        }
      } catch {
        // Ignorar payload que no sea JSON
      }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', {});
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  join(room) {
    if (!room) return;
    this.rooms.add(room);
    this.send({ action: 'join', room });
  }

  leave(room) {
    if (!room) return;
    this.rooms.delete(room);
    this.send({ action: 'leave', room });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data, room) {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        try {
          cb(data, room);
        } catch (err) {
          console.error(`Error en listener de evento ${event}:`, err);
        }
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const realtime = new RealtimeClient();
