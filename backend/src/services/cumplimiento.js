// HU-13: indicadores de cumplimiento calculados con los datos reales de la empresa.
// HU-12 reutiliza los mismos datos y el mismo cálculo para el reporte en PDF.
//
// Criterios de aceptación:
//   1. Cada indicador muestra verde, amarillo o rojo.
//   2. Al hacer clic en un indicador se ve qué falta para cumplirlo (`queFalta` y `detalles`).

import { diasEntre, fechaCorta, hoyEnColombia, sumarDias } from '../lib/fechas.js';

export const TIPOS_BRIGADA = {
  primeros_auxilios: 'Primeros auxilios',
  evacuacion: 'Evacuación',
  contra_incendios: 'Contra incendios',
};

const TIPOS_EQUIPO = { extintor: 'Extintor', botiquin: 'Botiquín', camilla: 'Camilla', otro: 'Equipo' };

// Equipos que vencen en este número de días o menos se consideran próximos a vencer (HU-11).
export const DIAS_PROXIMO_A_VENCER = 30;
// La norma pide al menos un simulacro al año.
export const DIAS_VIGENCIA_SIMULACRO = 365;

/**
 * Carga lo necesario para evaluar el cumplimiento de la empresa (o de una sola sede).
 * `sedeId` ya debe estar validado como sede de la empresa.
 */
export async function cargarDatos(db, empresaId, sedeId = null) {
  const filtroSede = sedeId ? 'AND s.id_sede = $2' : '';
  const params = sedeId ? [empresaId, sedeId] : [empresaId];

  const [sedes, planes, brigadas, miembros, simulacros, equipos, mapa] = await Promise.all([
    db.query(
      `SELECT s.id_sede, s.nombre, s.ciudad, s.direccion
         FROM sede s
        WHERE s.id_empresa = $1 ${filtroSede}
        ORDER BY lower(s.nombre)`,
      params
    ),
    db.query(
      `SELECT s.id_sede, v.numero, v.estado, v.contenido, v.aprobado_en, v.actualizado_en,
              ua.nombre AS aprobado_por
         FROM sede s
         JOIN plan_emergencia p ON p.id_sede = s.id_sede
         JOIN plan_version v ON v.id_plan = p.id_plan
         LEFT JOIN usuario ua ON ua.id_usuario = v.aprobado_por
        WHERE s.id_empresa = $1 ${filtroSede}
        ORDER BY v.numero DESC`,
      params
    ),
    db.query(
      `SELECT b.id_brigada, b.id_sede, b.tipo, l.nombre AS lider
         FROM brigada b
         JOIN sede s ON s.id_sede = b.id_sede
         JOIN usuario l ON l.id_usuario = b.id_lider
        WHERE s.id_empresa = $1 ${filtroSede}`,
      params
    ),
    db.query(
      `SELECT bu.id_brigada, u.nombre, u.correo, u.activo
         FROM brigada_usuario bu
         JOIN brigada b ON b.id_brigada = bu.id_brigada
         JOIN sede s ON s.id_sede = b.id_sede
         JOIN usuario u ON u.id_usuario = bu.id_usuario
        WHERE s.id_empresa = $1 ${filtroSede}
        ORDER BY lower(u.nombre)`,
      params
    ),
    db.query(
      `SELECT sm.id_simulacro, sm.id_sede, sm.fecha, sm.participantes, sm.tiempo_evacuacion,
              sm.observaciones, sm.plan_mejora, u.nombre AS registrado_por
         FROM simulacro sm
         JOIN sede s ON s.id_sede = sm.id_sede
         LEFT JOIN usuario u ON u.id_usuario = sm.id_usuario
        WHERE s.id_empresa = $1 ${filtroSede}
        ORDER BY sm.fecha DESC`,
      params
    ),
    db.query(
      `SELECT e.id_equipo, e.id_sede, e.tipo, e.nombre, e.ubicacion, e.fecha_vencimiento, e.estado
         FROM equipo e
         JOIN sede s ON s.id_sede = e.id_sede
        WHERE s.id_empresa = $1 ${filtroSede}
        ORDER BY e.fecha_vencimiento NULLS LAST, lower(e.nombre)`,
      params
    ),
    db.query(
      `SELECT s.id_sede,
              (SELECT count(*)::int FROM mapa_punto mp WHERE mp.id_sede = s.id_sede AND mp.tipo = 'punto_encuentro') AS puntos_encuentro,
              (SELECT count(*)::int FROM mapa_punto mp WHERE mp.id_sede = s.id_sede AND mp.tipo = 'salida') AS salidas,
              (SELECT count(*)::int FROM mapa_punto mp WHERE mp.id_sede = s.id_sede AND mp.tipo = 'extintor') AS extintores,
              (SELECT count(*)::int FROM mapa_ruta mr WHERE mr.id_sede = s.id_sede) AS rutas
         FROM sede s
        WHERE s.id_empresa = $1 ${filtroSede}`,
      params
    ),
  ]);

  const miembrosPorBrigada = agrupar(miembros.rows, 'id_brigada');
  const mapaPorSede = new Map(mapa.rows.map((r) => [r.id_sede, r]));

  return sedes.rows.map((s) => {
    const versiones = planes.rows.filter((v) => v.id_sede === s.id_sede);
    return {
      id: s.id_sede,
      nombre: s.nombre,
      ciudad: s.ciudad,
      direccion: s.direccion,
      // Versiones del plan, de la más reciente a la más antigua.
      versiones,
      planVigente: versiones.find((v) => v.estado === 'aprobado') ?? null,
      borrador: versiones.find((v) => v.estado === 'borrador') ?? null,
      brigadas: brigadas.rows
        .filter((b) => b.id_sede === s.id_sede)
        .map((b) => ({ ...b, miembros: miembrosPorBrigada.get(b.id_brigada) ?? [] })),
      simulacros: simulacros.rows.filter((sm) => sm.id_sede === s.id_sede),
      // Los equipos dados de baja ya no cuentan para el cumplimiento.
      equipos: equipos.rows.filter((e) => e.id_sede === s.id_sede),
      mapa: mapaPorSede.get(s.id_sede) ?? { puntos_encuentro: 0, salidas: 0, extintores: 0, rutas: 0 },
    };
  });
}

function agrupar(filas, campo) {
  const mapa = new Map();
  for (const fila of filas) {
    if (!mapa.has(fila[campo])) mapa.set(fila[campo], []);
    mapa.get(fila[campo]).push(fila);
  }
  return mapa;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

// Verde solo con el 100 %; rojo si no se ha avanzado nada.
const estadoPorAvance = (pct) => (pct >= 100 ? 'verde' : pct > 0 ? 'amarillo' : 'rojo');

/** Situación de un equipo a una fecha: 'vencido' | 'proximo' | 'mantenimiento' | 'al_dia' | 'baja'. */
export function situacionEquipo(equipo, hoy) {
  if (equipo.estado === 'baja') return 'baja';
  if (equipo.estado === 'vencido') return 'vencido';
  if (equipo.fecha_vencimiento && equipo.fecha_vencimiento < hoy) return 'vencido';
  if (equipo.fecha_vencimiento && equipo.fecha_vencimiento <= sumarDias(hoy, DIAS_PROXIMO_A_VENCER)) {
    return 'proximo';
  }
  if (equipo.estado === 'mantenimiento') return 'mantenimiento';
  return 'al_dia';
}

function indicadorPlan(sedes) {
  const aprobadas = sedes.filter((s) => s.planVigente);
  const pct = porcentaje(aprobadas.length, sedes.length);
  const sinPlan = sedes.filter((s) => !s.planVigente && !s.borrador);
  const enBorrador = sedes.filter((s) => !s.planVigente && s.borrador);

  const faltantes = [];
  if (sinPlan.length) faltantes.push(`Crea el plan de ${lista(sinPlan)}.`);
  if (enBorrador.length) faltantes.push(`Completa y aprueba el borrador de ${lista(enBorrador)}.`);

  return {
    id: 'plan_emergencia',
    titulo: 'Plan de emergencias aprobado',
    // Un borrador ya es avance: amarillo aunque ninguna sede tenga el plan aprobado.
    estado: pct >= 100 ? 'verde' : aprobadas.length || enBorrador.length ? 'amarillo' : 'rojo',
    porcentaje: pct,
    resumen: `${aprobadas.length} de ${plural(sedes.length, 'sede', 'sedes')} con plan aprobado.`,
    queFalta: faltantes.join(' ') || 'Todas las sedes tienen su plan de emergencias aprobado.',
    norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25 · Resolución 0312 de 2019',
    accion: { texto: 'Ir a sedes', ruta: '/sedes' },
    detalles: sedes.map((s) => ({
      texto: s.planVigente
        ? `${s.nombre}: versión ${s.planVigente.numero} aprobada${s.planVigente.aprobado_en ? ` el ${fechaCorta(fechaDe(s.planVigente.aprobado_en))}` : ''}${s.borrador ? ' (hay una versión nueva en borrador)' : ''}`
        : s.borrador
          ? `${s.nombre}: plan en borrador, falta aprobarlo`
          : `${s.nombre}: sin plan de emergencias`,
      cumple: Boolean(s.planVigente),
    })),
  };
}

function indicadorBrigadas(sedes) {
  const tipos = Object.keys(TIPOS_BRIGADA);
  const requeridas = sedes.length * tipos.length;
  const conformadas = sedes.reduce((n, s) => n + s.brigadas.length, 0);
  const pct = porcentaje(conformadas, requeridas);
  const incompletas = sedes.filter((s) => s.brigadas.length < tipos.length);

  return {
    id: 'brigadas',
    titulo: 'Brigadas conformadas',
    estado: estadoPorAvance(pct),
    porcentaje: pct,
    resumen: `${conformadas} de ${plural(requeridas, 'brigada requerida', 'brigadas requeridas')}.`,
    queFalta: incompletas.length
      ? `Cada sede necesita brigadas de primeros auxilios, evacuación y contra incendios, cada una con su líder. Faltan en ${lista(incompletas)}.`
      : 'Todas las sedes tienen sus tres brigadas conformadas con líder.',
    norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25, num. 12 · Resolución 0312 de 2019',
    accion: { texto: 'Ir a brigadas', ruta: '/brigadas' },
    detalles: sedes.map((s) => {
      const faltan = tipos.filter((t) => !s.brigadas.some((b) => b.tipo === t)).map((t) => TIPOS_BRIGADA[t].toLowerCase());
      return {
        texto: faltan.length
          ? `${s.nombre}: falta ${faltan.join(', ')}`
          : `${s.nombre}: las tres brigadas conformadas`,
        cumple: faltan.length === 0,
      };
    }),
  };
}

function indicadorSimulacros(sedes, hoy) {
  const desde = sumarDias(hoy, -DIAS_VIGENCIA_SIMULACRO);
  const conVigente = sedes.filter((s) => s.simulacros.some((sm) => sm.fecha >= desde));
  const pct = porcentaje(conVigente.length, sedes.length);
  const pendientes = sedes.filter((s) => !conVigente.includes(s));

  return {
    id: 'simulacros',
    titulo: 'Simulacro anual de evacuación',
    estado: estadoPorAvance(pct),
    porcentaje: pct,
    resumen: `${conVigente.length} de ${plural(sedes.length, 'sede', 'sedes')} con simulacro en el último año.`,
    queFalta: pendientes.length
      ? `La norma exige al menos un simulacro al año con todos los trabajadores. Realízalo y registra la evidencia en ${lista(pendientes)}.`
      : 'Todas las sedes tienen un simulacro registrado en los últimos 12 meses.',
    norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25, num. 11',
    accion: { texto: 'Registrar simulacro', ruta: '/mapa?registrarSimulacro=1' },
    detalles: sedes.map((s) => {
      const ultimo = s.simulacros[0];
      const vigente = ultimo && ultimo.fecha >= desde;
      return {
        texto: !ultimo
          ? `${s.nombre}: ningún simulacro registrado`
          : vigente
            ? `${s.nombre}: último simulacro el ${fechaCorta(ultimo.fecha)} (${plural(ultimo.participantes, 'participante', 'participantes')})`
            : `${s.nombre}: el último simulacro fue el ${fechaCorta(ultimo.fecha)}, hace más de un año`,
        cumple: Boolean(vigente),
      };
    }),
  };
}

function indicadorEquipos(sedes, hoy) {
  const activos = sedes.flatMap((s) =>
    s.equipos
      .map((e) => ({ ...e, sede: s.nombre, situacion: situacionEquipo(e, hoy) }))
      .filter((e) => e.situacion !== 'baja')
  );
  const vencidos = activos.filter((e) => e.situacion === 'vencido');
  const proximos = activos.filter((e) => e.situacion === 'proximo');
  const enMantenimiento = activos.filter((e) => e.situacion === 'mantenimiento');
  const alDia = activos.filter((e) => e.situacion === 'al_dia');
  const sinEquipos = sedes.filter((s) => !activos.some((e) => e.id_sede === s.id));

  // Un equipo vencido es un riesgo ante una inspección: rojo. Lo demás que falte: amarillo.
  let estado = 'verde';
  if (activos.length === 0 || vencidos.length) estado = 'rojo';
  else if (proximos.length || enMantenimiento.length || sinEquipos.length) estado = 'amarillo';

  const faltantes = [];
  if (vencidos.length) faltantes.push(`Recarga o reemplaza ${plural(vencidos.length, 'equipo vencido', 'equipos vencidos')}.`);
  if (proximos.length) faltantes.push(`Programa la recarga de ${plural(proximos.length, 'equipo que vence', 'equipos que vencen')} en los próximos ${DIAS_PROXIMO_A_VENCER} días.`);
  if (enMantenimiento.length) faltantes.push(`Hay ${plural(enMantenimiento.length, 'equipo', 'equipos')} en mantenimiento.`);
  if (sinEquipos.length) faltantes.push(`Registra los equipos de ${lista(sinEquipos)}.`);

  const detalleEquipo = (e) => {
    const nombre = `${TIPOS_EQUIPO[e.tipo] ?? 'Equipo'} ${e.nombre} · ${e.sede}`;
    if (e.situacion === 'vencido') {
      return e.fecha_vencimiento && e.fecha_vencimiento < hoy
        ? `${nombre}: vencido hace ${plural(diasEntre(e.fecha_vencimiento, hoy), 'día', 'días')}`
        : `${nombre}: marcado como vencido`;
    }
    if (e.situacion === 'proximo') {
      const dias = diasEntre(hoy, e.fecha_vencimiento);
      return `${nombre}: ${dias === 0 ? 'vence hoy' : `vence en ${plural(dias, 'día', 'días')}`}`;
    }
    return `${nombre}: en mantenimiento`;
  };

  const detalles = [
    ...[...vencidos, ...proximos, ...enMantenimiento].map((e) => ({ texto: detalleEquipo(e), cumple: false })),
    ...sinEquipos.map((s) => ({ texto: `${s.nombre}: sin equipos registrados`, cumple: false })),
  ];
  if (alDia.length) {
    detalles.push({ texto: `${plural(alDia.length, 'equipo al día', 'equipos al día')}`, cumple: true });
  }

  return {
    id: 'inventario_equipos',
    titulo: 'Equipos de emergencia al día',
    estado,
    porcentaje: porcentaje(alDia.length, activos.length),
    resumen: activos.length
      ? `${alDia.length} de ${plural(activos.length, 'equipo', 'equipos')} al día.`
      : 'Sin equipos registrados.',
    queFalta: faltantes.join(' ') || 'Todos los equipos están operativos y con su recarga vigente.',
    norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25, num. 13 · NTC 2885 (extintores)',
    accion: { texto: 'Ir al inventario', ruta: '/equipos' },
    detalles,
  };
}

function indicadorMapa(sedes) {
  // HU-07: cada sede muestra a dónde ir (punto de encuentro) y cómo llegar (ruta trazada).
  const tieneRuta = (s) => s.mapa.rutas > 0;
  const completa = (s) => s.mapa.puntos_encuentro > 0 && tieneRuta(s);
  const listas = sedes.filter(completa);
  const pct = porcentaje(listas.length, sedes.length);
  const pendientes = sedes.filter((s) => !completa(s));
  const conAlgo = sedes.some((s) => s.mapa.puntos_encuentro > 0 || tieneRuta(s));

  return {
    id: 'mapa_evacuacion',
    titulo: 'Mapa de evacuación',
    estado: pct >= 100 ? 'verde' : conAlgo ? 'amarillo' : 'rojo',
    porcentaje: pct,
    resumen: `${listas.length} de ${plural(sedes.length, 'sede', 'sedes')} con punto de encuentro y ruta de evacuación.`,
    queFalta: pendientes.length
      ? `El mapa de cada sede debe mostrar al menos un punto de encuentro y una ruta de evacuación trazada hasta él. Faltan en ${lista(pendientes)}.`
      : 'Todas las sedes tienen punto de encuentro y ruta de evacuación en su mapa.',
    norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25',
    accion: { texto: 'Ir al mapa', ruta: '/mapa' },
    detalles: sedes.map((s) => {
      const falta = [
        !s.mapa.puntos_encuentro && 'punto de encuentro',
        !tieneRuta(s) && 'ruta de evacuación',
      ].filter(Boolean);
      const tiene = [
        s.mapa.puntos_encuentro && plural(s.mapa.puntos_encuentro, 'punto de encuentro', 'puntos de encuentro'),
        s.mapa.salidas && plural(s.mapa.salidas, 'salida', 'salidas'),
        s.mapa.rutas && plural(s.mapa.rutas, 'ruta', 'rutas'),
      ].filter(Boolean);
      return {
        texto: falta.length ? `${s.nombre}: falta ${falta.join(' y ')}` : `${s.nombre}: ${tiene.join(', ')}`,
        cumple: falta.length === 0,
      };
    }),
  };
}

const lista = (sedes) => {
  const nombres = sedes.map((s) => s.nombre);
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
};

const fechaDe = (valor) => (valor instanceof Date ? hoyEnColombia(valor.getTime()) : String(valor).slice(0, 10));

/** Calcula los cinco indicadores y el resumen global a partir de `cargarDatos`. */
export function calcularCumplimiento(sedes, hoy = hoyEnColombia()) {
  if (sedes.length === 0) {
    return {
      fecha: hoy,
      porcentajeGlobal: 0,
      resumen: { cumplidos: 0, enProgreso: 0, criticos: 0, total: 0 },
      indicadores: [],
      sinSedes: true,
    };
  }

  const indicadores = [
    indicadorPlan(sedes),
    indicadorBrigadas(sedes),
    indicadorSimulacros(sedes, hoy),
    indicadorEquipos(sedes, hoy),
    indicadorMapa(sedes),
  ];
  const contar = (estado) => indicadores.filter((i) => i.estado === estado).length;

  return {
    fecha: hoy,
    porcentajeGlobal: Math.round(indicadores.reduce((n, i) => n + i.porcentaje, 0) / indicadores.length),
    resumen: {
      cumplidos: contar('verde'),
      enProgreso: contar('amarillo'),
      criticos: contar('rojo'),
      total: indicadores.length,
    },
    indicadores,
    sinSedes: false,
  };
}
