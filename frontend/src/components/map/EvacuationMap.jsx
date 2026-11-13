import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { rumbo } from '../../lib/mapa.js';
import { crearPin, useLeafletMap } from './leaflet.js';
import { crearIconoElemento } from './mapIcons.jsx';

const ESTILO_RUTA = { color: '#2E9E5B', weight: 5, opacity: 0.9, lineJoin: 'round' };
const ESTILO_RUTA_ACTIVA = { weight: 8, opacity: 1 };

// Flechas a mitad de cada tramo para indicar hacia dónde evacuar.
// El triángulo de .ma-route-arrow apunta al este; el rumbo se mide desde el norte.
function flechasDeRuta(trazado) {
  const flechas = [];
  for (let i = 0; i < trazado.length - 1; i++) {
    const [lat1, lng1] = trazado[i];
    const [lat2, lng2] = trazado[i + 1];
    const angulo = rumbo({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) - 90;
    flechas.push(
      L.marker([(lat1 + lat2) / 2, (lng1 + lng2) / 2], {
        icon: L.divIcon({
          className: '',
          html: `<span class="ma-route-arrow" style="transform: rotate(${angulo}deg)"></span>`,
          iconSize: [12, 16],
          iconAnchor: [6, 8],
        }),
        interactive: false,
        keyboard: false,
      })
    );
  }
  return flechas;
}

// HU-07: mapa de evacuación de la sede. Cada elemento se dibuja con su ícono
// (ver la leyenda) y se puede ocultar por tipo con `visibles`.
// HU-08: soporte de modo edición para mover puntos y hacer clic en el mapa.
export default function EvacuationMap({
  sede,
  puntos = [],
  rutas = [],
  visibles = [],
  seleccionado,
  onSelect,
  className = '',
  editando = false,
  onMoverPunto,
  onClicMapa,
}) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, {
    center: sede ?? { lat: 6.2442, lng: -75.5812 },
    zoom: 17,
    maxZoom: 19,
  });
  // id → { tipo, capa, marcador? , linea? }
  const elementosRef = useRef(new Map());
  const seleccionadoRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMoverPuntoRef = useRef(onMoverPunto);
  onMoverPuntoRef.current = onMoverPunto;
  const onClicMapaRef = useRef(onClicMapa);
  onClicMapaRef.current = onClicMapa;

  // Manejador de clics en el mapa en modo edición
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e) => {
      if (editando) {
        onClicMapaRef.current?.(e.latlng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mapRef, editando]);

  // Dibujar la sede, los puntos y las rutas, y encuadrarlos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sede) return;

    const capa = L.layerGroup().addTo(map);
    const elementos = new Map();
    const limites = L.latLngBounds([[sede.lat, sede.lng]]);

    L.marker([sede.lat, sede.lng], { icon: crearPin(), title: sede.nombre, keyboard: false })
      .bindTooltip(sede.nombre, { direction: 'top' })
      .addTo(capa);

    for (const ruta of rutas) {
      const trazado = Array.isArray(ruta.trazado) ? ruta.trazado : [];
      if (trazado.length < 2) continue;
      const linea = L.polyline(trazado, ESTILO_RUTA)
        .bindTooltip(ruta.nombre, { direction: 'top', sticky: true })
        .on('click', () => onSelectRef.current?.({ ...ruta, clase: 'ruta' }));
      const grupo = L.layerGroup([linea, ...flechasDeRuta(trazado)]);
      elementos.set(ruta.id, { tipo: 'ruta_evacuacion', capa: grupo, linea });
      trazado.forEach((coord) => limites.extend(coord));
    }

    for (const punto of puntos) {
      const marcador = L.marker([punto.lat, punto.lng], {
        icon: crearIconoElemento(punto.tipo, { arrastrable: editando }),
        keyboard: true,
        title: punto.nombre,
        riseOnHover: true,
        draggable: editando,
      })
        .bindTooltip(
          editando ? `${punto.nombre} (arrastra para reubicar)` : punto.nombre,
          { direction: 'top' }
        )
        .on('click', () => onSelectRef.current?.({ ...punto, clase: 'punto' }));

      if (editando) {
        marcador.on('dragend', (e) => {
          const coords = e.target.getLatLng();
          onMoverPuntoRef.current?.(punto.id, coords.lat, coords.lng);
        });
      }

      elementos.set(punto.id, { tipo: punto.tipo, capa: marcador, marcador });
      limites.extend([punto.lat, punto.lng]);
    }

    elementosRef.current = elementos;
    seleccionadoRef.current = null;

    if (elementos.size) map.fitBounds(limites, { padding: [48, 48], maxZoom: 19 });
    else map.setView([sede.lat, sede.lng], 17);

    return () => {
      capa.remove();
      for (const { capa: c } of elementos.values()) c.remove();
    };
  }, [mapRef, puntos, rutas, sede, editando]);

  // Mostrar u ocultar por tipo, según la leyenda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const activos = new Set(visibles ?? []);
    for (const { tipo, capa } of elementosRef.current.values()) {
      if (activos.has(tipo)) capa.addTo(map);
      else capa.remove();
    }
  }, [mapRef, visibles, puntos, rutas]);

  // Resaltar el elemento elegido en el mapa o en la lista.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const anterior = elementosRef.current.get(seleccionadoRef.current);
    if (anterior?.marcador) {
      anterior.marcador.setIcon(crearIconoElemento(anterior.tipo));
      anterior.marcador.setZIndexOffset(0);
    }
    if (anterior?.linea) anterior.linea.setStyle(ESTILO_RUTA);

    const id = seleccionado?.id ?? null;
    const actual = elementosRef.current.get(id);
    if (actual?.marcador) {
      actual.marcador.setIcon(crearIconoElemento(actual.tipo, { activo: true }));
      actual.marcador.setZIndexOffset(1000);
      map.panTo(actual.marcador.getLatLng());
    }
    if (actual?.linea) {
      actual.linea.setStyle(ESTILO_RUTA_ACTIVA).bringToFront();
      map.fitBounds(actual.linea.getBounds(), { padding: [48, 48], maxZoom: 19 });
    }
    seleccionadoRef.current = id;
  }, [mapRef, seleccionado]);

  // Leaflet necesita recalcular su tamaño si el contenedor cambia (p. ej. al girar el celular).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapRef]);

  return (
    <div
      ref={containerRef}
      className={`ma-map ${className}`}
      role="region"
      aria-label={`Mapa de evacuación de ${sede?.nombre ?? 'la sede'}`}
    />
  );
}
