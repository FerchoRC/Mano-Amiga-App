// HU-11: Utilidades y constantes para el inventario de equipos.
import {
  BedSingle,
  BriefcaseMedical,
  CircleAlert,
  Clock,
  FireExtinguisher,
  Wrench,
} from 'lucide-react';

export const TIPOS_EQUIPO = [
  { id: 'extintor', etiqueta: 'Extintor', icono: FireExtinguisher, tono: 'red' },
  { id: 'botiquin', etiqueta: 'Botiquín', icono: BriefcaseMedical, tono: 'blue' },
  { id: 'camilla', etiqueta: 'Camilla', icono: BedSingle, tono: 'blue' },
  { id: 'otro', etiqueta: 'Otro equipo', icono: Wrench, tono: 'gray' },
];

export const ESTADOS_EQUIPO = [
  { id: 'operativo', etiqueta: 'Operativo', clase: 'success' },
  { id: 'mantenimiento', etiqueta: 'En mantenimiento', clase: 'warning' },
  { id: 'vencido', etiqueta: 'Vencido o requiere recarga', clase: 'danger' },
  { id: 'baja', etiqueta: 'Dado de baja', clase: 'muted' },
];

export function tipoEquipo(id) {
  return TIPOS_EQUIPO.find((t) => t.id === id) ?? TIPOS_EQUIPO[TIPOS_EQUIPO.length - 1];
}

export function estadoEquipo(id) {
  return ESTADOS_EQUIPO.find((e) => e.id === id) ?? ESTADOS_EQUIPO[0];
}

/**
 * Calcula los días faltantes para el vencimiento (positivo: falta, negativo: vencido).
 */
export function diasParaVencer(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr + 'T00:00:00');
  const diferenciaMs = fecha.getTime() - hoy.getTime();
  return Math.round(diferenciaMs / (1000 * 60 * 60 * 24));
}

export function esProximoAVencer(fechaStr) {
  const dias = diasParaVencer(fechaStr);
  return dias !== null && dias >= 0 && dias <= 30;
}

export function estaVencido(fechaStr) {
  const dias = diasParaVencer(fechaStr);
  return dias !== null && dias < 0;
}
