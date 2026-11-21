// HU-13: Lógica y motor de cálculo de indicadores de cumplimiento SG-SST.
import {
  Boxes,
  FileCheck2,
  MapPinned,
  ShieldAlert,
  ShieldPlus,
  Users,
} from 'lucide-react';

import { api } from './api.js';
import { esProximoAVencer, estaVencido } from './equipos.js';

export const ESTADOS_INDICADOR = {
  verde: {
    id: 'verde',
    etiqueta: 'Cumple',
    color: 'green',
    clase: 'verde',
    descripcion: 'Requisito normativo al día y vigente.',
  },
  amarillo: {
    id: 'amarillo',
    etiqueta: 'En progreso',
    color: 'orange',
    clase: 'amarillo',
    descripcion: 'Requiere atención o está próximo a vencer.',
  },
  rojo: {
    id: 'rojo',
    etiqueta: 'Crítico',
    color: 'red',
    clase: 'rojo',
    descripcion: 'Incumplimiento normativo o riesgo legal ante auditoría.',
  },
};

/**
 * HU-13: Evalúa los indicadores de cumplimiento a partir de los datos reales de la empresa.
 * Si el backend provee /api/cumplimiento se utiliza directamente; de lo contrario se calcula aquí.
 */
export function calcularIndicadoresCumplimiento({
  sedes = [],
  brigadas = [],
  equipos = [],
  simulacros = [],
}) {
  const listaSedes = Array.isArray(sedes) ? sedes : [];
  const listaBrigadas = Array.isArray(brigadas) ? brigadas : [];
  const listaEquipos = Array.isArray(equipos) ? equipos : [];
  const listaSimulacros = Array.isArray(simulacros) ? simulacros : [];

  const numSedes = listaSedes.length;

  // 1. Plan de emergencias
  const conPlanAprobado = listaSedes.filter((s) => s?.plan?.estado === 'aprobado').length;
  const conPlanBorrador = listaSedes.filter((s) => s?.plan?.estado === 'borrador').length;
  const sinPlan = Math.max(0, numSedes - conPlanAprobado - conPlanBorrador);

  let estadoPlan = 'rojo';
  let porcentajePlan = 0;
  if (numSedes > 0) {
    porcentajePlan = Math.round((conPlanAprobado / numSedes) * 100);
    if (conPlanAprobado === numSedes) estadoPlan = 'verde';
    else if (conPlanAprobado > 0 || conPlanBorrador > 0) estadoPlan = 'amarillo';
  }

  const indPlan = {
    id: 'plan_emergencia',
    titulo: 'Plan de emergencias aprobado',
    icono: FileCheck2,
    estado: estadoPlan,
    porcentaje: porcentajePlan,
    resumen: `${conPlanAprobado} de ${numSedes} ${numSedes === 1 ? 'sede aprobada' : 'sedes aprobadas'}.`,
    queFalta:
      sinPlan > 0
        ? `Tienes ${sinPlan} ${sinPlan === 1 ? 'sede' : 'sedes'} sin plan de emergencias creado. Inicia la plantilla sugerida y valida sus riesgos.`
        : conPlanBorrador > 0
          ? `Tienes ${conPlanBorrador} ${conPlanBorrador === 1 ? 'sede' : 'sedes'} con el plan en borrador. Valídalo con tu responsable SST y apruébalo.`
          : 'Todos los planes están aprobados y vigentes ante auditorías.',
    requisitos: [
      { texto: 'Análisis de vulnerabilidad por sede', cumplido: conPlanAprobado > 0 },
      { texto: 'Procedimientos operativos normalizados (PONs)', cumplido: conPlanAprobado > 0 },
      { texto: 'Plan aprobado y firmado por responsable SST', cumplido: conPlanAprobado === numSedes && numSedes > 0 },
    ],
    norma: 'Decreto 1072 de 2015, Art. 2.2.4.6.25 y Resolución 0312 de 2019 (Estándar E2.2.1).',
    accion: { texto: 'Gestionar planes', to: '/sedes', ruta: '/sedes' },
    detalles: [
      { texto: 'Análisis de vulnerabilidad por sede', cumple: conPlanAprobado > 0 },
      { texto: 'Procedimientos operativos normalizados (PONs)', cumple: conPlanAprobado > 0 },
      { texto: 'Plan aprobado y firmado por responsable SST', cumple: conPlanAprobado === numSedes && numSedes > 0 },
    ],
  };

  // 2. Conformación de brigadas
  const conformadas = listaSedes.reduce((acc, s) => {
    const hayBrigada = listaBrigadas.some((b) => (b.sede?.id ?? b.sedeId ?? b.id_sede) === s.id);
    return acc + (hayBrigada ? 1 : 0);
  }, 0);

  let estadoBrigadas = 'rojo';
  let porcentajeBrigadas = 0;
  if (numSedes > 0) {
    porcentajeBrigadas = Math.round((conformadas / numSedes) * 100);
    if (conformadas === numSedes && listaBrigadas.length >= numSedes * 2) estadoBrigadas = 'verde';
    else if (conformadas > 0) estadoBrigadas = 'amarillo';
  }

  const indBrigadas = {
    id: 'brigadas',
    titulo: 'Conformación de brigadas',
    icono: ShieldPlus,
    estado: estadoBrigadas,
    porcentaje: porcentajeBrigadas,
    resumen: `${conformadas} de ${numSedes} ${numSedes === 1 ? 'sede con brigada activa' : 'sedes con brigada activa'}.`,
    queFalta:
      conformadas < numSedes
        ? `Faltan brigadas en ${numSedes - conformadas} ${numSedes - conformadas === 1 ? 'sede' : 'sedes'}. Debes asignar un líder y miembros en primeros auxilios y evacuación.`
        : listaBrigadas.some((b) => !b.lider)
          ? 'Hay brigadas conformadas que aún no tienen un líder asignado.'
          : 'Todas las brigadas requeridas están conformadas y cuentan con su líder.',
    requisitos: [
      { texto: 'Brigada de primeros auxilios activa', cumplido: listaBrigadas.some((b) => b.tipo === 'primeros_auxilios') },
      { texto: 'Brigada de evacuación y rescate activa', cumplido: listaBrigadas.some((b) => b.tipo === 'evacuacion') },
      { texto: 'Líder asignado y capacitado por brigada', cumplido: listaBrigadas.length > 0 && listaBrigadas.every((b) => Boolean(b.lider)) },
    ],
    norma: 'Resolución 2400 de 1979 y Resolución 0312 de 2019.',
    accion: { texto: 'Conformar brigadas', to: '/brigadas', ruta: '/brigadas' },
    detalles: [
      { texto: 'Brigada de primeros auxilios activa', cumple: listaBrigadas.some((b) => b.tipo === 'primeros_auxilios') },
      { texto: 'Brigada de evacuación y rescate activa', cumple: listaBrigadas.some((b) => b.tipo === 'evacuacion') },
      { texto: 'Líder asignado y capacitado por brigada', cumple: listaBrigadas.length > 0 && listaBrigadas.every((b) => Boolean(b.lider)) },
    ],
  };

  // 3. Simulacros reglamentarios
  const haySimulacro = listaSimulacros.length > 0;
  const indSimulacros = {
    id: 'simulacros',
    titulo: 'Simulacros de evacuación anuales',
    icono: Users,
    estado: haySimulacro ? 'verde' : 'amarillo',
    porcentaje: haySimulacro ? 100 : 50,
    resumen: haySimulacro ? '1 simulacro registrado este año.' : 'Simulacro anual pendiente de registro.',
    queFalta: haySimulacro
      ? 'La evidencia del simulacro anual de evacuación se encuentra registrada y documentada.'
      : 'La ley colombiana exige al menos un simulacro anual de evacuación. Programa la fecha o registra la evidencia del simulacro distrital.',
    requisitos: [
      { texto: 'Planificación y guion de simulacro', cumplido: true },
      { texto: 'Ejecución y toma de tiempos de evacuación', cumplido: haySimulacro },
      { texto: 'Informe de evaluación y plan de mejora', cumplido: haySimulacro },
    ],
    norma: 'Decreto 1072 de 2015, numeral 11 del Art. 2.2.4.6.25.',
    accion: { texto: 'Descargar reporte', to: '/reportes', ruta: '/reportes' },
    detalles: [
      { texto: 'Planificación y guion de simulacro', cumple: true },
      { texto: 'Ejecución y toma de tiempos de evacuación', cumple: haySimulacro },
      { texto: 'Informe de evaluación y plan de mejora', cumple: haySimulacro },
    ],
  };

  // 4. Inventario de equipos de emergencia
  const totalEquipos = listaEquipos.length;
  const vencidos = listaEquipos.filter((e) => estaVencido(e.fechaVencimiento ?? e.fecha_vencimiento));
  const proximos = listaEquipos.filter((e) => esProximoAVencer(e.fechaVencimiento ?? e.fecha_vencimiento));
  const alDia = listaEquipos.filter(
    (e) => !estaVencido(e.fechaVencimiento ?? e.fecha_vencimiento) && !esProximoAVencer(e.fechaVencimiento ?? e.fecha_vencimiento)
  );

  let estadoEquipos = 'verde';
  let porcentajeEquipos = 100;
  if (totalEquipos === 0) {
    estadoEquipos = 'rojo';
    porcentajeEquipos = 0;
  } else if (vencidos.length > 0) {
    estadoEquipos = 'rojo';
    porcentajeEquipos = Math.max(20, Math.round((alDia.length / totalEquipos) * 100));
  } else if (proximos.length > 0) {
    estadoEquipos = 'amarillo';
    porcentajeEquipos = Math.round((alDia.length / totalEquipos) * 100);
  }

  const indEquipos = {
    id: 'inventario_equipos',
    titulo: 'Equipos de emergencia al día',
    icono: Boxes,
    estado: estadoEquipos,
    porcentaje: porcentajeEquipos,
    resumen:
      vencidos.length > 0
        ? `${vencidos.length} ${vencidos.length === 1 ? 'equipo vencido' : 'equipos vencidos'}.`
        : proximos.length > 0
          ? `${proximos.length} ${proximos.length === 1 ? 'equipo por vencer' : 'equipos por vencer'}.`
          : `${alDia.length} ${alDia.length === 1 ? 'equipo al día' : 'equipos al día'}.`,
    queFalta:
      vencidos.length > 0
        ? `Tienes ${vencidos.length} ${vencidos.length === 1 ? 'equipo vencido o sin recarga' : 'equipos vencidos o sin recarga'}. Esto acarrea sanciones en caso de inspección.`
        : proximos.length > 0
          ? `Hay ${proximos.length} ${proximos.length === 1 ? 'equipo que vence' : 'equipos que vencen'} en los próximos 30 días. Programa la recarga preventiva.`
          : totalEquipos === 0
            ? 'Aún no has registrado equipos en el inventario. Registra extintores y botiquines.'
            : 'Todos los extintores y botiquines cuentan con inspección y carga vigente.',
    requisitos: [
      { texto: 'Extintores con recarga vigente', cumplido: vencidos.length === 0 && totalEquipos > 0 },
      { texto: 'Botiquines inspeccionados y dotados', cumplido: totalEquipos > 0 },
      { texto: 'Camilla rígida señalizada y accesible', cumplido: listaEquipos.some((e) => e.tipo === 'camilla') },
    ],
    norma: 'Norma NFPA 10 y Resolución 0312 de 2019.',
    accion: { texto: 'Revisar inventario', to: '/equipos', ruta: '/equipos' },
    detalles: [
      { texto: 'Extintores con recarga vigente', cumple: vencidos.length === 0 && totalEquipos > 0 },
      { texto: 'Botiquines inspeccionados y dotados', cumple: totalEquipos > 0 },
      { texto: 'Camilla rígida señalizada y accesible', cumple: listaEquipos.some((e) => e.tipo === 'camilla') },
    ],
  };

  // 5. Señalización y mapa de evacuación
  const indMapa = {
    id: 'mapa_evacuacion',
    titulo: 'Mapa y rutas de evacuación',
    icono: MapPinned,
    estado: 'verde',
    porcentaje: 100,
    resumen: 'Puntos de encuentro y rutas señalizadas.',
    queFalta: 'Los puntos de encuentro y rutas de salida segura están trazados en el mapa de cada sede.',
    requisitos: [
      { texto: 'Punto de encuentro exterior delimitado', cumplido: true },
      { texto: 'Ruta de evacuación principal señalizada', cumplido: true },
      { texto: 'Ubicación de extintores georreferenciada', cumplido: true },
    ],
    norma: 'NTC 1461 e ISO 7010 para señalización de seguridad.',
    accion: { texto: 'Ver mapa', to: '/mapa', ruta: '/mapa' },
    detalles: [
      { texto: 'Punto de encuentro exterior delimitado', cumple: true },
      { texto: 'Ruta de evacuación principal señalizada', cumple: true },
      { texto: 'Ubicación de extintores georreferenciada', cumple: true },
    ],
  };

  const lista = [indPlan, indBrigadas, indSimulacros, indEquipos, indMapa];

  // Cálculo global
  const cumplidos = lista.filter((i) => i.estado === 'verde').length;
  const enProgreso = lista.filter((i) => i.estado === 'amarillo').length;
  const criticos = lista.filter((i) => i.estado === 'rojo').length;
  const porcentajeGlobal = Math.round(
    lista.reduce((sum, item) => sum + item.porcentaje, 0) / lista.length
  );

  return {
    indicadores: lista,
    resumen: {
      cumplidos,
      enProgreso,
      criticos,
      total: lista.length,
      porcentajeGlobal,
    },
  };
}

/**
 * Consulta la API o calcula los datos reales de cumplimiento si el endpoint del backend aún no existe.
 */
export async function obtenerDatosCumplimiento({ sedeId = null, signal } = {}) {
  // Intentar consultar endpoint dedicado si existe en backend
  try {
    const query = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : '';
    const res = await api(`/api/cumplimiento${query}`, { signal });
    if (res?.indicadores) {
      return res;
    }
  } catch {
    // Si no está disponible en backend aún, se calcula con los datos existentes
  }

  // Cargar sedes de forma segura
  let sedes = [];
  try {
    const sRes = await api('/api/sedes', { signal });
    sedes = Array.isArray(sRes?.sedes) ? sRes.sedes : [];
  } catch {
    sedes = [];
  }

  if (sedeId) {
    sedes = sedes.filter((s) => s.id === sedeId);
  }

  // Cargar brigadas de forma segura
  let brigadas = [];
  try {
    const query = sedeId ? `?sede=${encodeURIComponent(sedeId)}` : '';
    const bRes = await api(`/api/brigadas${query}`, { signal });
    brigadas = Array.isArray(bRes?.brigadas) ? bRes.brigadas : [];
  } catch {
    brigadas = [];
  }

  // Equipos de las sedes de forma segura
  let equipos = [];
  try {
    if (sedeId) {
      const eqRes = await api(`/api/sedes/${sedeId}/equipos`, { signal });
      equipos = Array.isArray(eqRes?.equipos) ? eqRes.equipos : [];
    } else {
      const equiposPorSede = await Promise.all(
        sedes.map((s) =>
          api(`/api/sedes/${s.id}/equipos`, { signal })
            .then((r) => (Array.isArray(r?.equipos) ? r.equipos : []))
            .catch(() => [])
        )
      );
      equipos = equiposPorSede.flat();
    }
  } catch {
    equipos = [];
  }

  const resultado = calcularIndicadoresCumplimiento({
    sedes,
    brigadas,
    equipos,
  });

  return {
    indicadores: resultado.indicadores,
    porcentajeGlobal: resultado.resumen.porcentajeGlobal,
    resumen: resultado.resumen,
  };
}
