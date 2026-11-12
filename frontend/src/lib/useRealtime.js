import { useEffect } from 'react';

import { realtime } from './realtime.js';

/**
 * Hook para escuchar eventos en tiempo real vía WebSocket.
 * Inicia la conexión automáticamente si no está activa.
 */
export function useRealtimeEvent(event, callback) {
  useEffect(() => {
    realtime.connect();
    return realtime.on(event, callback);
  }, [event, callback]);
}

/**
 * Hook para unirse a una sala específica (p. ej. 'alerta:123') mientras el componente esté montado.
 */
export function useRealtimeRoom(room) {
  useEffect(() => {
    if (!room) return;
    realtime.connect();
    realtime.join(room);
    return () => realtime.leave(room);
  }, [room]);
}
