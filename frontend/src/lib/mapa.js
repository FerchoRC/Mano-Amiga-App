import { BedSingle, BriefcaseMedical, DoorOpen, FireExtinguisher, Route, UsersRound } from 'lucide-react';

// Coinciden con el contrato del backend para el mapa de evacuación.
export const TIPOS_ELEMENTO = [
  {
    id: 'punto_encuentro',
    etiqueta: 'Punto de encuentro',
    plural: 'Puntos de encuentro',
    icono: UsersRound,
    tono: 'green',
  },
  {
    id: 'ruta_evacuacion',
    etiqueta: 'Ruta de evacuación',
    plural: 'Rutas de evacuación',
    icono: Route,
    tono: 'green',
  },
  {
    id: 'salida',
    etiqueta: 'Salida de emergencia',
    plural: 'Salidas de emergencia',
    icono: DoorOpen,
    tono: 'green',
  },
  {
    id: 'extintor',
    etiqueta: 'Extintor',
    plural: 'Extintores',
    icono: FireExtinguisher,
    tono: 'red',
  },
  {
    id: 'botiquin',
    etiqueta: 'Botiquín',
    plural: 'Botiquines',
    icono: BriefcaseMedical,
    tono: 'blue',
  },
  {
    id: 'camilla',
    etiqueta: 'Camilla',
    plural: 'Camillas',
    icono: BedSingle,
    tono: 'blue',
  },
];

export const tipoElemento = (id) => TIPOS_ELEMENTO.find((tipo) => tipo.id === id) ?? null;

export function rumbo(a, b) {
  if (!a || !b) return 0;
  const dLng = (b.lng - a.lng) * (Math.PI / 180);
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let angulo = (Math.atan2(y, x) * 180) / Math.PI;
  angulo = (angulo + 360) % 360;
  return angulo;
}
