// HU-05: contenido del plan de emergencias de una sede.
// El borrador acepta datos a medio llenar; para aprobarlo, cada sección
// debe estar completa (revisarPlan). El frontend replica estas reglas
// en frontend/src/pages/sedes/planContent.js.
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

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

export const NIVELES_RIESGO = ['bajo', 'medio', 'alto'];

const id = z.string().min(1).max(40);
const texto = (max) => z.string().max(max, `Máximo ${max} caracteres.`).default('');

export const contenidoSchema = z.object({
  riesgos: z
    .array(
      z.object({
        id,
        tipo: z.enum(TIPOS_RIESGO, 'Elige un tipo de riesgo válido.'),
        descripcion: texto(500),
        nivel: z.enum(NIVELES_RIESGO, 'Elige un nivel válido.'),
      })
    )
    .max(50, 'Máximo 50 riesgos.'),
  procedimientos: z
    .array(
      z.object({
        id,
        titulo: texto(120),
        pasos: z.array(z.string().max(300, 'Cada paso admite máximo 300 caracteres.')).max(30),
      })
    )
    .max(30, 'Máximo 30 procedimientos.'),
  puntosEncuentro: z
    .array(
      z.object({
        id,
        nombre: texto(120),
        referencia: texto(300),
        capacidad: z.number().int().min(1).max(100000).nullable().default(null),
      })
    )
    .max(20, 'Máximo 20 puntos de encuentro.'),
});

export const contenidoVacio = () => ({ riesgos: [], procedimientos: [], puntosEncuentro: [] });

const lleno = (valor) => valor.trim().length > 0;

// Lo que falta para poder aprobar el plan, por sección. Objeto vacío = completo.
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

// Al aprobar se guardan solo los pasos con texto.
export function limpiarContenido(contenido) {
  return {
    ...contenido,
    procedimientos: contenido.procedimientos.map((p) => ({
      ...p,
      pasos: p.pasos.map((paso) => paso.trim()).filter(Boolean),
    })),
  };
}

// Punto de partida para empresas del Valle de Aburrá. Debe validarlo un
// profesional SST: por eso los puntos de encuentro quedan sin ubicación.
export function plantillaPlan() {
  return {
    riesgos: [
      {
        id: randomUUID(),
        tipo: 'Sismo',
        descripcion:
          'El Valle de Aburrá está en zona de amenaza sísmica intermedia. Revisar estructuras, estanterías y objetos que puedan caer.',
        nivel: 'medio',
      },
      {
        id: randomUUID(),
        tipo: 'Incendio',
        descripcion:
          'Presencia de material combustible, instalaciones eléctricas y equipos en uso durante la jornada.',
        nivel: 'medio',
      },
    ],
    procedimientos: [
      {
        id: randomUUID(),
        titulo: 'Evacuación general',
        pasos: [
          'Al escuchar la alarma, suspende tus actividades y conserva la calma.',
          'Sigue la ruta de evacuación señalizada. No uses ascensores.',
          'Dirígete al punto de encuentro y repórtate con el brigadista de evacuación.',
          'No regreses a la sede hasta que la brigada lo autorice.',
        ],
      },
      {
        id: randomUUID(),
        titulo: 'Durante un sismo',
        pasos: [
          'Aléjate de ventanas, estanterías y objetos que puedan caer.',
          'Agáchate, cúbrete y sujétate junto a una estructura firme.',
          'Cuando termine el movimiento, evacúa por las rutas señalizadas.',
        ],
      },
      {
        id: randomUUID(),
        titulo: 'Conato de incendio',
        pasos: [
          'Da la voz de alarma y avisa a la brigada contra incendios.',
          'Si estás capacitado y es seguro, usa el extintor más cercano.',
          'Si el fuego no se controla en segundos, evacúa y cierra las puertas a tu paso.',
        ],
      },
    ],
    puntosEncuentro: [
      { id: randomUUID(), nombre: 'Punto de encuentro principal', referencia: '', capacidad: null },
    ],
  };
}
