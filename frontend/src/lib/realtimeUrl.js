// Dirección del WebSocket del tiempo real (alertas, respuestas y cambios del mapa).
// 1. VITE_WS_URL, si se definió (p. ej. wss://api.manoamiga.co/ws).
// 2. Si la API está en otro dominio (VITE_API_URL), el mismo dominio con /ws.
// 3. Si no, el dominio del frontend (en desarrollo, Vite lo redirige al backend).
export function urlTiempoReal({ wsUrl, apiUrl } = {}, ubicacion = window.location) {
  if (wsUrl) return wsUrl;
  if (apiUrl) {
    const url = new URL('/ws', apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  }
  const protocolo = ubicacion.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocolo}//${ubicacion.host}/ws`;
}
