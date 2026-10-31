import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

import { tipoElemento } from '../../lib/mapa.js';

const CACHE = new Map();

export function crearIconoElemento(tipo, { activo = false } = {}) {
  const config = tipoElemento(tipo) ?? tipoElemento('punto_encuentro');
  const tono = config?.tono ?? 'green';
  const clave = `${tipo}-${activo ? 'activo' : 'inactivo'}`;

  if (CACHE.has(clave)) {
    return CACHE.get(clave);
  }

  const Icono = config?.icono ?? tipoElemento('punto_encuentro').icono;
  const svg = renderToStaticMarkup(
    <Icono size={18} strokeWidth={2.25} color="#fff" aria-hidden="true" />
  );

  const icon = L.divIcon({
    className: `ma-poi ma-poi--${tono}${activo ? ' is-active' : ''}`,
    html: `<span class="ma-poi__disc">${svg}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    tooltipAnchor: [0, -22],
  });

  CACHE.set(clave, icon);
  return icon;
}
