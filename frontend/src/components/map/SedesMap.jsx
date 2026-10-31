import { useEffect, useRef } from 'react';

import { crearPin, L, useLeafletMap } from './leaflet.js';

// Mapa con todas las sedes. Resalta la sede activa y avisa al hacer clic.
export default function SedesMap({ sedes, activa, onSelect, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef);
  const marcadores = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Dibujar los marcadores y encuadrar todas las sedes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const capa = L.layerGroup().addTo(map);
    marcadores.current = new Map();

    for (const sede of sedes) {
      const marcador = L.marker([sede.lat, sede.lng], {
        icon: crearPin(),
        title: sede.nombre,
        keyboard: true,
      })
        .bindTooltip(sede.nombre, { direction: 'top' })
        .on('click', () => onSelectRef.current?.(sede))
        .addTo(capa);
      marcadores.current.set(sede.id, marcador);
    }

    if (sedes.length === 1) {
      map.setView([sedes[0].lat, sedes[0].lng], 15);
    } else if (sedes.length > 1) {
      map.fitBounds(L.latLngBounds(sedes.map((s) => [s.lat, s.lng])), { padding: [48, 48], maxZoom: 15 });
    }

    return () => capa.remove();
  }, [sedes, mapRef]);

  // Resaltar la sede activa.
  useEffect(() => {
    for (const [id, marcador] of marcadores.current) {
      marcador.setIcon(crearPin({ activo: id === activa }));
      if (id === activa) marcador.setZIndexOffset(1000);
      else marcador.setZIndexOffset(0);
    }
  }, [activa, sedes]);

  return <div ref={containerRef} className={`ma-map ${className}`} role="region" aria-label="Mapa de sedes" />;
}
