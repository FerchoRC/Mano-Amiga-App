import { DoorOpen, Flame, HeartPulse } from 'lucide-react';

// Coinciden con el backend: cada brigada de la sede tiene un tipo fijo.
export const TIPOS_BRIGADA = [
  {
    id: 'primeros_auxilios',
    etiqueta: 'Primeros auxilios',
    icono: HeartPulse,
    tono: 'blue',
    descripcion: 'Atiende a quien resulte herido hasta que llegue ayuda médica.',
  },
  {
    id: 'evacuacion',
    etiqueta: 'Evacuación',
    icono: DoorOpen,
    tono: 'green',
    descripcion: 'Guía la salida ordenada de la sede en caso de emergencia.',
  },
  {
    id: 'contra_incendios',
    etiqueta: 'Contra incendios',
    icono: Flame,
    tono: 'red',
    descripcion: 'Responde ante humo, fuego y riesgo de propagación.',
  },
];

export const tipoBrigada = (id) => TIPOS_BRIGADA.find((tipo) => tipo.id === id) ?? null;

export function validarBrigada({ miembrosIds = [], liderId }) {
  const errores = {};

  if (!liderId) {
    errores.liderId = 'Elige quién lidera la brigada.';
  }

  if (!miembrosIds.length) {
    errores.miembrosIds = 'Elige al menos un brigadista.';
  }

  if (liderId && miembrosIds.length > 0 && !miembrosIds.includes(liderId)) {
    errores.liderId = 'El líder debe ser parte de la brigada.';
  }

  return errores;
}
