// HU-12: reporte para auditoría en PDF con plan, brigadas, simulacros e inventario.
// Criterios: se descarga en PDF y se puede filtrar por sede y rango de fechas.
//
// El rango de fechas define qué simulacros y qué versiones aprobadas del plan entran
// al reporte, y qué versión del plan estaba vigente al cierre del periodo. El
// inventario y las brigadas se muestran como están el día en que se genera.

import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';

import { fechaCorta, hoyEnColombia } from '../lib/fechas.js';
import { formatNit } from '../lib/nit.js';
import { calcularCumplimiento, situacionEquipo, TIPOS_BRIGADA } from './cumplimiento.js';

export const SECCIONES = ['plan', 'brigadas', 'simulacros', 'inventario'];

const FUENTES = {
  texto: fileURLToPath(new URL('../../assets/fonts/inter-variable.ttf', import.meta.url)),
  titulo: fileURLToPath(new URL('../../assets/fonts/poppins-semibold.ttf', import.meta.url)),
};

const C = {
  navy: '#16325C',
  red: '#D7263D',
  text: '#2B2F36',
  muted: '#5B6472',
  subtle: '#8A93A1',
  border: '#D9DEE5',
  soft: '#F4F6F8',
  verde: '#1F7A44',
  verdeFondo: '#E7F4EC',
  amarillo: '#9A5300',
  amarilloFondo: '#FDF1E2',
  rojo: '#B01E31',
  rojoFondo: '#FBE9EB',
};

const SEMAFORO = {
  verde: { etiqueta: 'Cumple', color: C.verde, fondo: C.verdeFondo },
  amarillo: { etiqueta: 'En progreso', color: C.amarillo, fondo: C.amarilloFondo },
  rojo: { etiqueta: 'Crítico', color: C.rojo, fondo: C.rojoFondo },
};

const SITUACION_EQUIPO = {
  vencido: { etiqueta: 'Vencido', color: C.rojo },
  proximo: { etiqueta: 'Por vencer', color: C.amarillo },
  mantenimiento: { etiqueta: 'Mantenimiento', color: C.amarillo },
  al_dia: { etiqueta: 'Al día', color: C.verde },
  baja: { etiqueta: 'De baja', color: C.subtle },
};

const TIPO_EQUIPO = { extintor: 'Extintor', botiquin: 'Botiquín', camilla: 'Camilla', otro: 'Otro' };
const NIVEL_RIESGO = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };

const MARGEN = 50;
const ANCHO_PAGINA = 595.28; // A4
const ALTO_PAGINA = 841.89;
const ANCHO = ANCHO_PAGINA - MARGEN * 2;
const LIMITE_INFERIOR = ALTO_PAGINA - 70;

const fechaDe = (valor) =>
  valor instanceof Date ? hoyEnColombia(valor.getTime()) : valor ? String(valor).slice(0, 10) : null;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Lo que entra al reporte de cada sede según el periodo:
 * - plan vigente al cierre (la última versión aprobada hasta `hasta`) y las aprobadas en el periodo;
 * - simulacros con fecha dentro del periodo;
 * - brigadas e inventario tal como están hoy.
 */
export function prepararSedes(sedes, { desde, hasta }) {
  return sedes.map((sede) => {
    const aprobadas = sede.versiones.filter((v) => v.estado === 'aprobado');
    return {
      ...sede,
      planAlCierre: aprobadas.find((v) => fechaDe(v.aprobado_en) <= hasta) ?? null,
      versionesEnPeriodo: aprobadas.filter((v) => {
        const f = fechaDe(v.aprobado_en);
        return f >= desde && f <= hasta;
      }),
      simulacrosEnPeriodo: sede.simulacros.filter((sm) => sm.fecha >= desde && sm.fecha <= hasta),
    };
  });
}

/**
 * Genera el PDF y lo escribe en `destino` (un stream, p. ej. la respuesta HTTP).
 * `sedes` viene de `cargarDatos`; el filtro de sede ya se aplicó al cargarlas.
 */
export function generarReporte(destino, { empresa, sedes, desde, hasta, secciones, emitidoPor, hoy = hoyEnColombia() }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 64, bottom: 60, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: `Reporte para auditoría · ${empresa.razon_social}`,
      Author: 'ManoAmiga',
      Subject: 'Preparación y respuesta ante emergencias (SG-SST)',
    },
  });
  doc.registerFont('texto', FUENTES.texto);
  doc.registerFont('titulo', FUENTES.titulo);
  doc.pipe(destino);

  const cumplimiento = calcularCumplimiento(sedes, hoy);
  const ctx = { doc, desde, hasta, hoy };

  portada(ctx, { empresa, sedes, emitidoPor, cumplimiento });

  for (const sede of prepararSedes(sedes, { desde, hasta })) {
    doc.addPage();
    encabezadoSede(ctx, sede);
    let numero = 1;
    if (secciones.includes('plan')) seccionPlan(ctx, sede, numero++);
    if (secciones.includes('brigadas')) seccionBrigadas(ctx, sede, numero++);
    if (secciones.includes('simulacros')) seccionSimulacros(ctx, sede, numero++);
    if (secciones.includes('inventario')) seccionInventario(ctx, sede, numero++);
  }

  firmas(ctx);
  pieDePagina(ctx, empresa);
  doc.end();
}

// ---------------------------------------------------------------- bloques

function portada({ doc, desde, hasta, hoy }, { empresa, sedes, emitidoPor, cumplimiento }) {
  logo(doc, MARGEN, 46, 46);
  doc
    .font('titulo')
    .fontSize(11)
    .fillColor(C.navy)
    .text('ManoAmiga', MARGEN + 56, 52)
    .font('texto')
    .fontSize(8.5)
    .fillColor(C.muted)
    .text('Gestión de emergencias para empresas', MARGEN + 56, 67);

  doc.moveTo(MARGEN, 100).lineTo(MARGEN + ANCHO, 100).lineWidth(0.6).strokeColor(C.border).stroke();

  doc
    .font('titulo')
    .fontSize(24)
    .fillColor(C.navy)
    .text('Reporte para auditoría', MARGEN, 122)
    .font('texto')
    .fontSize(10.5)
    .fillColor(C.muted)
    .text('Plan de prevención, preparación y respuesta ante emergencias (SG-SST)', { width: ANCHO });

  // Ficha de la empresa
  const filas = [
    ['Empresa', empresa.razon_social],
    ['NIT', formatNit(empresa.nit, empresa.digito_verificacion)],
    ['Sector', empresa.sector],
    ['Trabajadores', String(empresa.num_empleados)],
    ['Sedes incluidas', sedes.length ? sedes.map((s) => s.nombre).join(', ') : 'Ninguna'],
    ['Periodo', `${fechaCorta(desde)} al ${fechaCorta(hasta)}`],
    ['Emitido', `${fechaCorta(hoy)} por ${emitidoPor}`],
  ];
  let y = doc.y + 22;
  const inicio = y;
  const anchoEtiqueta = 110;
  doc.fontSize(9.5);
  const alturas = filas.map(([, valor]) => doc.font('texto').heightOfString(valor, { width: ANCHO - anchoEtiqueta - 32 }) + 10);
  const alto = alturas.reduce((a, b) => a + b, 0) + 16;
  doc.roundedRect(MARGEN, inicio, ANCHO, alto, 8).fillColor(C.soft).fill();
  y += 8;
  filas.forEach(([etiqueta, valor], i) => {
    doc.font('texto').fillColor(C.muted).text(etiqueta, MARGEN + 16, y + 5, { width: anchoEtiqueta });
    doc.font('titulo').fillColor(C.text).text(valor, MARGEN + 16 + anchoEtiqueta, y + 5, { width: ANCHO - anchoEtiqueta - 32 });
    y += alturas[i];
  });

  // Resumen de cumplimiento (HU-13)
  y = inicio + alto + 30;
  doc.font('titulo').fontSize(14).fillColor(C.navy).text('Resumen de cumplimiento', MARGEN, y);
  doc
    .font('texto')
    .fontSize(9)
    .fillColor(C.muted)
    .text(`Estado al ${fechaCorta(hoy)}. Verde: cumple · Amarillo: en progreso · Rojo: crítico.`, MARGEN, doc.y + 2);

  y = doc.y + 12;
  if (cumplimiento.sinSedes) {
    doc.font('texto').fontSize(10).fillColor(C.text).text('La empresa aún no tiene sedes registradas.', MARGEN, y);
    return;
  }

  const global = cumplimiento.porcentajeGlobal;
  const estadoGlobal = global >= 85 ? 'verde' : global >= 60 ? 'amarillo' : 'rojo';
  doc.roundedRect(MARGEN, y, ANCHO, 54, 8).lineWidth(0.8).strokeColor(C.border).stroke();
  doc.font('titulo').fontSize(26).fillColor(SEMAFORO[estadoGlobal].color).text(`${global}%`, MARGEN + 18, y + 11, { width: 90 });
  doc
    .font('titulo')
    .fontSize(11)
    .fillColor(C.text)
    .text('Cumplimiento general', MARGEN + 112, y + 12)
    .font('texto')
    .fontSize(9)
    .fillColor(C.muted)
    .text(
      `${plural(cumplimiento.resumen.cumplidos, 'indicador cumple', 'indicadores cumplen')}, ${cumplimiento.resumen.enProgreso} en progreso y ${plural(cumplimiento.resumen.criticos, 'crítico', 'críticos')}.`,
      MARGEN + 112,
      y + 29,
      { width: ANCHO - 130 }
    );
  y += 66;

  for (const ind of cumplimiento.indicadores) {
    const sem = SEMAFORO[ind.estado];
    const anchoTexto = ANCHO - 150;
    doc.fontSize(9);
    const altoFila = Math.max(
      34,
      doc.font('titulo').heightOfString(ind.titulo, { width: anchoTexto }) +
        doc.font('texto').heightOfString(ind.resumen, { width: anchoTexto }) +
        14
    );
    y = asegurarEspacio(doc, y, altoFila);
    doc.circle(MARGEN + 8, y + 12, 4.5).fillColor(sem.color).fill();
    doc.font('titulo').fontSize(9.5).fillColor(C.text).text(ind.titulo, MARGEN + 22, y + 5, { width: anchoTexto });
    doc.font('texto').fontSize(9).fillColor(C.muted).text(ind.resumen, MARGEN + 22, doc.y + 1, { width: anchoTexto });
    pastilla(doc, `${sem.etiqueta} · ${ind.porcentaje}%`, MARGEN + ANCHO - 112, y + 5, 112, sem);
    y += altoFila;
    doc.moveTo(MARGEN, y - 4).lineTo(MARGEN + ANCHO, y - 4).lineWidth(0.4).strokeColor(C.border).stroke();
  }
}

function encabezadoSede({ doc }, sede) {
  doc.font('texto').fontSize(8.5).fillColor(C.subtle).text('SEDE', MARGEN, 64, { characterSpacing: 1.2 });
  doc.font('titulo').fontSize(18).fillColor(C.navy).text(sede.nombre, MARGEN, doc.y + 1, { width: ANCHO });
  doc
    .font('texto')
    .fontSize(9.5)
    .fillColor(C.muted)
    .text([sede.direccion, sede.ciudad].filter(Boolean).join(' · '), { width: ANCHO });
  doc.moveDown(0.8);
}

function tituloSeccion(doc, numero, titulo) {
  let y = asegurarEspacio(doc, doc.y + 10, 60);
  doc.circle(MARGEN + 9, y + 9, 9).fillColor(C.navy).fill();
  doc.font('titulo').fontSize(9).fillColor('#FFFFFF').text(String(numero), MARGEN, y + 3.5, { width: 18, align: 'center' });
  doc.font('titulo').fontSize(12.5).fillColor(C.navy).text(titulo, MARGEN + 26, y + 1, { width: ANCHO - 26 });
  doc.y = Math.max(doc.y, y + 22) + 4;
  doc.x = MARGEN;
}

function seccionPlan({ doc, hasta }, sede, numero) {
  tituloSeccion(doc, numero, 'Plan de emergencias');

  const vigente = sede.planAlCierre;
  const enPeriodo = sede.versionesEnPeriodo;

  if (!vigente) {
    nota(doc, sede.borrador
      ? `No había un plan aprobado al ${fechaCorta(hasta)}. Hay una versión en borrador sin aprobar.`
      : `No había un plan aprobado al ${fechaCorta(hasta)}.`, 'rojo');
    return;
  }

  parrafo(
    doc,
    `Versión ${vigente.numero}, aprobada el ${fechaCorta(fechaDe(vigente.aprobado_en))}${vigente.aprobado_por ? ` por ${vigente.aprobado_por}` : ''}.` +
      (enPeriodo.length
        ? ` En el periodo se ${enPeriodo.length === 1 ? 'aprobó la versión' : 'aprobaron las versiones'} ${enPeriodo.map((v) => v.numero).reverse().join(', ')}.`
        : ' No se aprobaron versiones nuevas en el periodo.')
  );

  const { riesgos = [], procedimientos = [], puntosEncuentro = [] } = vigente.contenido ?? {};

  subtitulo(doc, 'Riesgos identificados');
  tabla(
    doc,
    [
      { titulo: 'Riesgo', ancho: 120 },
      { titulo: 'Nivel', ancho: 60 },
      { titulo: 'Descripción', ancho: ANCHO - 180 },
    ],
    riesgos.map((r) => [r.tipo, NIVEL_RIESGO[r.nivel] ?? r.nivel, r.descripcion]),
    'Sin riesgos registrados.'
  );

  subtitulo(doc, 'Procedimientos');
  if (!procedimientos.length) parrafo(doc, 'Sin procedimientos registrados.', C.muted);
  for (const p of procedimientos) {
    asegurarEspacio(doc, doc.y, 40);
    doc.font('titulo').fontSize(9.5).fillColor(C.text).text(p.titulo || 'Sin título', MARGEN, doc.y, { width: ANCHO });
    p.pasos.filter((paso) => paso.trim()).forEach((paso, i) => {
      asegurarEspacio(doc, doc.y, 16);
      doc.font('texto').fontSize(9).fillColor(C.text).text(`${i + 1}. ${paso}`, MARGEN + 12, doc.y + 1, { width: ANCHO - 12 });
    });
    doc.moveDown(0.5);
  }

  subtitulo(doc, 'Puntos de encuentro');
  tabla(
    doc,
    [
      { titulo: 'Punto', ancho: 140 },
      { titulo: 'Cómo llegar', ancho: ANCHO - 210 },
      { titulo: 'Capacidad', ancho: 70 },
    ],
    puntosEncuentro.map((p) => [p.nombre, p.referencia, p.capacidad ? `${p.capacidad} personas` : '—']),
    'Sin puntos de encuentro registrados.'
  );
}

function seccionBrigadas({ doc }, sede, numero) {
  tituloSeccion(doc, numero, 'Brigadas de emergencia');
  const filas = Object.entries(TIPOS_BRIGADA).map(([tipo, nombre]) => {
    const brigada = sede.brigadas.find((b) => b.tipo === tipo);
    if (!brigada) return [nombre, 'Sin conformar', '—'];
    const miembros = brigada.miembros.map((m) => (m.activo ? m.nombre : `${m.nombre} (inactivo)`));
    return [nombre, brigada.lider, miembros.length ? miembros.join(', ') : '—'];
  });
  tabla(
    doc,
    [
      { titulo: 'Brigada', ancho: 115 },
      { titulo: 'Líder', ancho: 120 },
      { titulo: 'Integrantes', ancho: ANCHO - 235 },
    ],
    filas,
    '',
    (fila) => (fila[1] === 'Sin conformar' ? { 1: C.rojo } : null)
  );
}

function seccionSimulacros({ doc, desde, hasta }, sede, numero) {
  tituloSeccion(doc, numero, 'Simulacros de evacuación');
  const enPeriodo = sede.simulacrosEnPeriodo;

  if (!enPeriodo.length) {
    nota(doc, `No se registraron simulacros entre el ${fechaCorta(desde)} y el ${fechaCorta(hasta)}.`, 'amarillo');
    return;
  }

  tabla(
    doc,
    [
      { titulo: 'Fecha', ancho: 80 },
      { titulo: 'Participantes', ancho: 75 },
      { titulo: 'Tiempo', ancho: 60 },
      { titulo: 'Observaciones y plan de mejora', ancho: ANCHO - 215 },
    ],
    enPeriodo.map((s) => [
      fechaCorta(s.fecha),
      String(s.participantes),
      s.tiempo_evacuacion || '—',
      [s.observaciones && `Observaciones: ${s.observaciones}`, s.plan_mejora && `Plan de mejora: ${s.plan_mejora}`]
        .filter(Boolean)
        .join('\n') || '—',
    ]),
    ''
  );
}

function seccionInventario({ doc, hoy }, sede, numero) {
  tituloSeccion(doc, numero, 'Inventario de equipos');
  parrafo(doc, `Estado al ${fechaCorta(hoy)}.`, C.muted);
  const equipos = sede.equipos.map((e) => ({ ...e, situacion: situacionEquipo(e, hoy) }));
  tabla(
    doc,
    [
      { titulo: 'Equipo', ancho: 130 },
      { titulo: 'Tipo', ancho: 62 },
      { titulo: 'Ubicación', ancho: ANCHO - 342 },
      { titulo: 'Vencimiento', ancho: 75 },
      { titulo: 'Estado', ancho: 75 },
    ],
    equipos.map((e) => [
      e.nombre,
      TIPO_EQUIPO[e.tipo] ?? e.tipo,
      e.ubicacion,
      e.fecha_vencimiento ? fechaCorta(e.fecha_vencimiento) : 'No vence',
      SITUACION_EQUIPO[e.situacion].etiqueta,
    ]),
    'Sin equipos registrados.',
    (_, i) => ({ 4: SITUACION_EQUIPO[equipos[i].situacion].color })
  );
}

function firmas({ doc }) {
  let y = asegurarEspacio(doc, doc.y + 30, 110);
  doc.font('titulo').fontSize(11).fillColor(C.navy).text('Constancia', MARGEN, y);
  doc
    .font('texto')
    .fontSize(9)
    .fillColor(C.muted)
    .text(
      'Este reporte consolida la información registrada en ManoAmiga por la empresa. Su contenido debe ser revisado y firmado por los responsables antes de presentarlo.',
      MARGEN,
      doc.y + 3,
      { width: ANCHO }
    );
  y = doc.y + 46;
  const anchoFirma = (ANCHO - 40) / 2;
  for (const [i, rol] of ['Responsable del SG-SST', 'Representante legal'].entries()) {
    const x = MARGEN + i * (anchoFirma + 40);
    doc.moveTo(x, y).lineTo(x + anchoFirma, y).lineWidth(0.6).strokeColor(C.text).stroke();
    doc.font('texto').fontSize(9).fillColor(C.muted).text(rol, x, y + 5, { width: anchoFirma });
  }
}

function pieDePagina({ doc }, empresa) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const y = ALTO_PAGINA - 42;
    // Escribir fuera de los márgenes sin que pdfkit agregue páginas.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(MARGEN, y - 8).lineTo(MARGEN + ANCHO, y - 8).lineWidth(0.4).strokeColor(C.border).stroke();
    doc
      .font('texto')
      .fontSize(8)
      .fillColor(C.subtle)
      .text(`ManoAmiga · Reporte para auditoría · ${empresa.razon_social}`, MARGEN, y, { width: ANCHO - 80, lineBreak: false })
      .text(`Página ${i + 1} de ${count}`, MARGEN + ANCHO - 80, y, { width: 80, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenInferior;
  }
}

// ---------------------------------------------------------------- utilidades

function logo(doc, x, y, ancho) {
  const escala = ancho / 384;
  doc.save().translate(x, y).scale(escala);
  doc.polygon([0, 106], [192, 0], [384, 106], [384, 145], [192, 38], [0, 145]).fill(C.red);
  doc.polygon([0, 168], [45, 143], [45, 227], [0, 227]).fill(C.navy);
  doc
    .path('M56 143 85 122 107 154 152 84 192 61 384 168V227H349V193H215V227H170V121L119 201H95ZM215 113 300 159H215Z')
    .fill(C.navy, 'even-odd');
  doc.restore();
}

function pastilla(doc, texto, x, y, ancho, { color, fondo }) {
  doc.roundedRect(x, y, ancho, 18, 9).fillColor(fondo).fill();
  doc.font('titulo').fontSize(8).fillColor(color).text(texto, x, y + 4.5, { width: ancho, align: 'center' });
}

function subtitulo(doc, texto) {
  asegurarEspacio(doc, doc.y + 6, 50);
  doc.font('titulo').fontSize(9).fillColor(C.muted).text(texto.toUpperCase(), MARGEN, doc.y + 6, { characterSpacing: 0.8 });
  doc.moveDown(0.3);
}

function parrafo(doc, texto, color = C.text) {
  asegurarEspacio(doc, doc.y, 20);
  doc.font('texto').fontSize(9.5).fillColor(color).text(texto, MARGEN, doc.y, { width: ANCHO });
  doc.moveDown(0.4);
}

function nota(doc, texto, estado) {
  const sem = SEMAFORO[estado];
  doc.font('texto').fontSize(9.5);
  const alto = doc.heightOfString(texto, { width: ANCHO - 28 }) + 16;
  const y = asegurarEspacio(doc, doc.y, alto);
  doc.roundedRect(MARGEN, y, ANCHO, alto, 6).fillColor(sem.fondo).fill();
  doc.fillColor(sem.color).text(texto, MARGEN + 14, y + 8, { width: ANCHO - 28 });
  doc.y = y + alto + 8;
}

/**
 * Tabla simple con encabezado repetido al cambiar de página.
 * `colorCelda(fila, i)` devuelve { [columna]: color } para resaltar celdas.
 */
function tabla(doc, columnas, filas, vacio, colorCelda = () => null) {
  if (!filas.length) {
    if (vacio) parrafo(doc, vacio, C.muted);
    return;
  }
  const relleno = 6;
  const encabezado = (y) => {
    doc.rect(MARGEN, y, ANCHO, 20).fillColor(C.soft).fill();
    let x = MARGEN;
    for (const col of columnas) {
      doc.font('titulo').fontSize(8).fillColor(C.muted).text(col.titulo, x + relleno, y + 6, { width: col.ancho - relleno * 2, lineBreak: false });
      x += col.ancho;
    }
    return y + 20;
  };

  let y = asegurarEspacio(doc, doc.y + 2, 46);
  y = encabezado(y);
  filas.forEach((fila, i) => {
    doc.font('texto').fontSize(9);
    const alto =
      Math.max(...fila.map((celda, c) => doc.heightOfString(String(celda ?? ''), { width: columnas[c].ancho - relleno * 2 }))) +
      relleno * 2;
    if (y + alto > LIMITE_INFERIOR) {
      doc.addPage();
      y = encabezado(doc.page.margins.top);
    }
    const colores = colorCelda(fila, i) ?? {};
    let x = MARGEN;
    fila.forEach((celda, c) => {
      doc
        .font(colores[c] ? 'titulo' : 'texto')
        .fontSize(9)
        .fillColor(colores[c] ?? C.text)
        .text(String(celda ?? ''), x + relleno, y + relleno, { width: columnas[c].ancho - relleno * 2 });
      x += columnas[c].ancho;
    });
    y += alto;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO, y).lineWidth(0.4).strokeColor(C.border).stroke();
  });
  doc.x = MARGEN;
  doc.y = y + 10;
}

function asegurarEspacio(doc, y, alto) {
  if (y + alto > LIMITE_INFERIOR) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}
