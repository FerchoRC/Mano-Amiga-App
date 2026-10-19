import { ListChecks, MapPinned, TriangleAlert } from 'lucide-react';

// Mismas reglas que backend/src/lib/plan.js, para avisar antes de aprobar.

export const TIPOS_RIESGO = [
  'Sismo',
  'Incendio',
  'Inundación',
  'Explosión',
  'Fuga o derrame químico',
  'Riesgo eléctrico',
  'Deslizamiento',
  'Orden público',
  'Emergencia médica',
  'Otro',
];

export const NIVELES = [
  { id: 'bajo', etiqueta: 'Bajo' },
  { id: 'medio', etiqueta: 'Medio' },
  { id: 'alto', etiqueta: 'Alto' },
];

export const SECCIONES = [
  {
    id: 'riesgos',
    titulo: 'Riesgos identificados',
    corto: 'Riesgos',
    icono: TriangleAlert,
    descripcion: 'Las amenazas a las que está expuesta la sede y qué tan probable o grave es cada una.',
  },
  {
    id: 'procedimientos',
    titulo: 'Procedimientos',
    corto: 'Procedimientos',
    icono: ListChecks,
    descripcion: 'Qué debe hacer cada persona, paso a paso, en cada tipo de emergencia.',
  },
  {
    id: 'puntosEncuentro',
    titulo: 'Puntos de encuentro',
    corto: 'Encuentro',
    icono: MapPinned,
    descripcion: 'Los lugares seguros donde se reúne el equipo después de evacuar.',
  },
];

const nuevoId = () => crypto.randomUUID();

export const nuevoRiesgo = () => ({ id: nuevoId(), tipo: 'Sismo', descripcion: '', nivel: 'medio' });
export const nuevoProcedimiento = () => ({ id: nuevoId(), titulo: '', pasos: [''] });
export const nuevoPunto = () => ({ id: nuevoId(), nombre: '', referencia: '', capacidad: null });

const lleno = (valor) => valor.trim().length > 0;

// Lo que falta para poder aprobar, por sección. Objeto vacío = completo.
export function revisarPlan({ riesgos, procedimientos, puntosEncuentro }) {
  const faltantes = {};

  if (riesgos.length === 0) faltantes.riesgos = 'Agrega al menos un riesgo identificado.';
  else if (riesgos.some((r) => !lleno(r.descripcion))) {
    faltantes.riesgos = 'Describe cada riesgo identificado.';
  }

  if (procedimientos.length === 0) faltantes.procedimientos = 'Agrega al menos un procedimiento.';
  else if (procedimientos.some((p) => !lleno(p.titulo) || !p.pasos.some(lleno))) {
    faltantes.procedimientos = 'Cada procedimiento necesita un título y al menos un paso.';
  }

  if (puntosEncuentro.length === 0) {
    faltantes.puntosEncuentro = 'Agrega al menos un punto de encuentro.';
  } else if (puntosEncuentro.some((p) => !lleno(p.nombre) || !lleno(p.referencia))) {
    faltantes.puntosEncuentro = 'Indica el nombre y cómo llegar a cada punto de encuentro.';
  }

  return faltantes;
}
