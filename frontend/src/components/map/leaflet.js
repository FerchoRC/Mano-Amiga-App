import 'leaflet/dist/leaflet.css';
import './map.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

// Centro por defecto: Medellín, donde arranca el mercado de ManoAmiga.
export const CENTRO_POR_DEFECTO = { lat: 6.2442, lng: -75.5812 };

const PIN_SVG = `
  <svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true">
    <path fill="currentColor" d="M14 35s11-11.2 11-20A11 11 0 0 0 3 15c0 8.8 11 20 11 20Z"/>
    <circle cx="14" cy="14.5" r="4.5" fill="#fff"/>
  </svg>`;

export function crearPin({ activo = false, arrastrable = false } = {}) {
  return L.divIcon({
    className: `ma-pin${activo ? ' is-active' : ''}${arrastrable ? ' is-draggable' : ''}`,
    html: PIN_SVG,
    iconSize: [28, 36],
    iconAnchor: [14, 35],
    tooltipAnchor: [0, -32],
  });
}

// Crea un mapa de Leaflet con OpenStreetMap dentro de `containerRef` y lo
// destruye al desmontar. La rueda del mouse solo hace zoom tras un clic en el
// mapa, para no atrapar el desplazamiento de la página.
export function useLeafletMap(containerRef, { center = CENTRO_POR_DEFECTO, zoom = 12 } = {}) {
  const mapRef = useRef(null);

  useEffect(() => {
    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // El mapa se crea una sola vez; centro y zoom iniciales no lo recrean.
  }, []);

  return mapRef;
}

export { L };
