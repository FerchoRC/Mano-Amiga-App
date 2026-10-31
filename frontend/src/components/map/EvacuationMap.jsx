import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { tipoElemento } from '../../lib/mapa.js';
import { useLeafletMap } from './leaflet.js';
import { crearIconoElemento } from './mapIcons.jsx';

function mapaTipo(tipo) {
  return tipoElemento(tipo)?.tono ?? 'green';
}

export default function EvacuationMap({
  sede,
  puntos = [],
  rutas = [],
  visibles = [],
  seleccionado,
  onSelect,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, {
    center: sede ?? { lat: 6.2442, lng: -75.5812 },
    zoom: 18,
    maxZoom: 19,
  });
  const gruposRef = useRef(new Map());
  const marcadoresRef = useRef(new Map());
  const rutasRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  const seleccionadoRef = useRef(null);

  onSelectRef.current = onSelect;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sede) return;

    const capas = new Map();
    const puntosLayer = L.layerGroup().addTo(map);
    const rutasLayer = L.layerGroup().addTo(map);
    capas.set('puntos', puntosLayer);
    capas.set('rutas', rutasLayer);
    gruposRef.current = capas;
    marcadoresRef.current = new Map();
    rutasRef.current = new Map();

    for (const punto of puntos) {
      const tipo = punto.tipo ?? 'punto_encuentro';
      const marcador = L.marker([punto.lat, punto.lng], {
        icon: crearIconoElemento(tipo),
        keyboard: true,
        title: punto.nombre,
      })
        .bindTooltip(punto.nombre, { direction: 'top' })
        .on('click', () => onSelectRef.current?.({ ...punto, tipo: 'punto' }))
        .addTo(puntosLayer);
      marcadoresRef.current.set(punto.id, { tipo, marker: marcador });
    }

    for (const ruta of rutas) {
      const coords = Array.isArray(ruta.trazado) && ruta.trazado.length ? ruta.trazado : [];
      const polyline = L.polyline(coords, {
        color: '#2E9E5B',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
      })
        .bindTooltip(ruta.nombre, { direction: 'top' })
        .on('click', () => onSelectRef.current?.({ ...ruta, tipo: 'ruta' }))
        .addTo(rutasLayer);
      rutasRef.current.set(ruta.id, polyline);
    }

    map.setView([sede.lat, sede.lng], 17);

    return () => {
      for (const capa of capas.values()) capa.remove();
    };
  }, [mapRef, puntos, rutas, sede]);

  useEffect(() => {
    const visiblesSet = new Set(visibles ?? []);
    for (const [tipo, capa] of gruposRef.current) {
      if (tipo === 'puntos') {
        const cosas = Array.from(marcadoresRef.current.values()).map(({ tipo: itemTipo, marker }) => ({ itemTipo, marker }));
        cosas.forEach(({ itemTipo, marker }) => {
          const visible = visiblesSet.has(itemTipo) || itemTipo === 'ruta_evacuacion';
          if (visible) marker.addTo(capa); else marker.remove();
        });
      }

      if (tipo === 'rutas') {
        const rutasLayer = capa;
        const todas = Array.from(rutasRef.current.values());
        todas.forEach((ruta) => {
          const visible = visiblesSet.has('ruta_evacuacion');
          if (visible) ruta.addTo(rutasLayer); else ruta.remove();
        });
      }
    }
  }, [visibles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const key = seleccionado && (seleccionado.id ?? seleccionado);
    const prev = seleccionadoRef.current;

    if (prev && marcadoresRef.current.has(prev)) {
      const actual = marcadoresRef.current.get(prev);
      actual.marker.setIcon(crearIconoElemento(actual.tipo));
      actual.marker.setZIndexOffset(0);
    }

    if (key && marcadoresRef.current.has(key)) {
      const actual = marcadoresRef.current.get(key);
      actual.marker.setIcon(crearIconoElemento(actual.tipo, { activo: true }));
      actual.marker.setZIndexOffset(1000);
      map.panTo([actual.marker.getLatLng().lat, actual.marker.getLatLng().lng]);
    }

    if (key && rutasRef.current.has(key)) {
      const actual = rutasRef.current.get(key);
      actual.setStyle({ weight: 7, opacity: 1 });
      const bounds = L.latLngBounds(actual.getLatLngs());
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    }

    seleccionadoRef.current = key;
  }, [mapRef, seleccionado]);

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
