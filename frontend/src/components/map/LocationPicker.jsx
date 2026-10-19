import { useEffect, useRef } from 'react';

import { CENTRO_POR_DEFECTO, crearPin, L, useLeafletMap } from './leaflet.js';

// HU-04: selector de la ubicación de una sede. Un clic en el mapa pone el
// marcador y se puede arrastrar para ajustarlo. Cada vez que cambia `enfoque`
// el mapa se centra en `value` (por ejemplo, al elegir un resultado de búsqueda).
export default function LocationPicker({ value, onChange, enfoque = 0, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, {
    center: value ?? CENTRO_POR_DEFECTO,
    zoom: value ? 16 : 12,
  });
  const marcadorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const redondear = ({ lat, lng }) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (event) => onChangeRef.current(redondear(event.latlng));
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [mapRef]);

  // Mantener el marcador sincronizado con el valor.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }
    // Si el mapa se recreó (p. ej. en modo estricto de React), el marcador anterior ya no sirve.
    if (!marcadorRef.current || !map.hasLayer(marcadorRef.current)) {
      marcadorRef.current = L.marker(value, {
        icon: crearPin({ activo: true, arrastrable: true }),
        draggable: true,
        autoPan: true,
        title: 'Ubicación de la sede',
      })
        .on('dragend', (event) => onChangeRef.current(redondear(event.target.getLatLng())))
        .addTo(map);
    } else {
      marcadorRef.current.setLatLng(value);
    }
  }, [value, mapRef]);

  useEffect(() => {
    if (enfoque && value) mapRef.current?.setView(value, 17);
    // Solo se recentra cuando lo pide `enfoque`, no con cada arrastre.
  }, [enfoque]);

  return (
    <div
      ref={containerRef}
      className={`ma-map ${className}`}
      role="application"
      aria-label="Mapa para ubicar la sede. Haz clic para poner el marcador."
    />
  );
}
