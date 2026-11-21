import { PDFDocument, PDFName, PDFString, rgb, StandardFonts } from 'pdf-lib';

const MM = 72 / 25.4;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const MARGIN_X = 18 * MM;
const MARGIN_TOP = 14 * MM;
const MARGIN_BOTTOM = 20 * MM;

const COLORS = {
  navy: '#16325C', red: '#D7263D', blue: '#2F6FDE', green: '#2E9E5B', orange: '#F28C28',
  greenText: '#1F7A44', orangeText: '#B35F00', redText: '#B01E31', text: '#2B2F36',
  muted: '#5B6472', border: '#D9DEE5', soft: '#F4F6F8', white: '#FFFFFF',
};

function color(hex) {
  const value = hex.replace('#', '');
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

function fechaEsCo(valor, actualSiVacio = false) {
  if (!valor) {
    if (!actualSiVacio) return '';
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
    }).format(new Date());
  }
  const coincide = /^\d{4}-\d{2}-\d{2}$/.exec(String(valor));
  const fecha = coincide
    ? new Date(`${valor}T12:00:00-05:00`)
    : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  }).format(fecha);
}

function rangoFechas(desde, hasta) {
  const inicio = fechaEsCo(desde);
  const fin = fechaEsCo(hasta);
  if (inicio && fin) return `${inicio} al ${fin}`;
  return inicio || fin || '';
}

function limpiarNombreArchivo(valor) {
  return String(valor || 'empresa')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'empresa';
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      let part = '';
      for (const character of word) {
        const next = part + character;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) part = next;
        else {
          if (part) lines.push(part);
          part = character;
        }
      }
      line = part;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(page, text, x, yTop, maxWidth, font, size, lineHeight, colorValue) {
  const lines = wrapText(text, font, size, maxWidth);
  let y = yTop;
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, font, size, color: colorValue });
    y -= lineHeight;
  }
  return y;
}

async function cargarFuentes(pdfDoc) {
  let regular;
  let bold;
  try {
    const [regularBytes, boldBytes] = await Promise.all([
      fetch('/fonts/inter-variable.ttf').then((r) => r.arrayBuffer()),
      fetch('/fonts/poppins-semibold.ttf').then((r) => r.arrayBuffer()),
    ]);
    regular = await pdfDoc.embedFont(regularBytes, { subset: true });
    bold = await pdfDoc.embedFont(boldBytes, { subset: true });
  } catch {
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  if (!bold) bold = regular;
  return { regular, bold };
}

function stateInfo(estado) {
  if (estado === 'verde') return { label: 'Cumplido', tone: COLORS.green, text: COLORS.greenText, shape: 'circle' };
  if (estado === 'rojo') return { label: 'Crítico', tone: COLORS.red, text: COLORS.redText, shape: 'x' };
  return { label: 'En progreso', tone: COLORS.orange, text: COLORS.orangeText, shape: 'triangle' };
}

function sectionState(id, resumen) {
  const indicadorId = {
    plan: 'plan_emergencia',
    brigadas: 'brigadas',
    simulacros: 'simulacros',
    inventario: 'inventario_equipos',
  }[id];

  const indicador = resumen?.indicadores?.find((item) => item.id === indicadorId);
  if (indicador?.estado === 'verde') return 'verde';
  if (indicador?.estado === 'rojo') return 'rojo';
  if (indicador?.estado === 'amarillo') return 'amarillo';

  const total = Number(resumen?.totalSedes || 0);
  const planes = Number(resumen?.planesAprobados || 0);
  if (id === 'plan') return total > 0 && planes === total ? 'verde' : planes > 0 ? 'amarillo' : 'rojo';
  if (id === 'inventario') return 'rojo';
  return 'amarillo';
}

function logo(page, x, yBottom, height) {
  const scale = height / 227;
  const width = 384 * scale;
  page.drawSvgPath('M0 106L192 0L384 106L384 145L192 38L0 145Z', { x, y: yBottom + height, scale, color: color(COLORS.red) });
  page.drawSvgPath('M0 168L45 143L45 227L0 227Z', { x, y: yBottom + height, scale, color: color(COLORS.navy) });
  page.drawSvgPath(
    'M56 143L85 122L107 154L152 84L192 61L384 168V227H349V193H215V227H170V121L119 201H95ZM215 113L300 159H215Z',
    { x, y: yBottom + height, scale, color: color(COLORS.navy) }
  );
  return width;
}

function drawTopBar(page) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 4 * MM, width: PAGE_WIDTH, height: 4 * MM, color: color(COLORS.navy) });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 4 * MM, width: 30 * MM, height: 4 * MM, color: color(COLORS.red) });
}

function pageHeaderCompact(page, empresa, fonts) {
  drawTopBar(page);
  const yBottom = PAGE_HEIGHT - MARGIN_TOP - 7 * MM;
  logo(page, MARGIN_X, yBottom, 7 * MM);
  const text = `Reporte de auditoría y cumplimiento · ${empresa?.razonSocial || ''}`;
  const textWidth = fonts.bold.widthOfTextAtSize(text, 8);
  page.drawText(text, {
    x: Math.max(MARGIN_X, PAGE_WIDTH - MARGIN_X - textWidth), y: yBottom + 2 * MM,
    font: fonts.bold, size: 8, color: color(COLORS.navy),
  });
}

function drawFooter(page, pageNumber, totalPages, fonts) {
  const y = MARGIN_BOTTOM - 8;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 0.3 * MM, color: color(COLORS.border) });
  page.drawText('ManoAmiga · Gestión integral de emergencias', { x: MARGIN_X, y: y - 10, font: fonts.regular, size: 8, color: color(COLORS.muted) });
  const right = `Página ${pageNumber} de ${totalPages}`;
  page.drawText(right, { x: PAGE_WIDTH - MARGIN_X - fonts.regular.widthOfTextAtSize(right, 8), y: y - 10, font: fonts.regular, size: 8, color: color(COLORS.muted) });
}

function drawSectionTitle(page, number, title, yTop, fonts) {
  const circleSize = 6 * MM;
  const circleY = yTop - circleSize;
  page.drawEllipse({ x: MARGIN_X + circleSize / 2, y: circleY + circleSize / 2, xScale: circleSize / 2, yScale: circleSize / 2, color: color(COLORS.navy) });
  const numberText = String(number);
  const numberWidth = fonts.bold.widthOfTextAtSize(numberText, 10);
  page.drawText(numberText, { x: MARGIN_X + circleSize / 2 - numberWidth / 2, y: circleY + (circleSize - 10) / 2 + 2, font: fonts.bold, size: 10, color: color(COLORS.white) });
  page.drawText(title, { x: MARGIN_X + circleSize + 4 * MM, y: yTop - 13, font: fonts.bold, size: 13, color: color(COLORS.navy) });
  return yTop - 13 - 4 * MM;
}

function drawStatePill(page, x, y, estado, fonts) {
  const info = stateInfo(estado);
  const textWidth = fonts.bold.widthOfTextAtSize(info.label, 8.5);
  const pillWidth = 18 * MM + textWidth;
  const pillHeight = 5 * MM;
  page.drawRectangle({ x, y: y - pillHeight, width: pillWidth, height: pillHeight, color: color('#F4F6F8') });

  if (info.shape === 'circle') {
    page.drawEllipse({ x: x + 3 * MM, y: y - pillHeight / 2, xScale: 1.5 * MM, yScale: 1.5 * MM, color: color(info.tone) });
  } else if (info.shape === 'triangle') {
    const cx = x + 3 * MM;
    const cy = y - pillHeight / 2;
    page.drawSvgPath('M0 6L-5.1 -5.1L5.1 -5.1Z', { x: cx, y: cy, color: color(info.tone) });
  } else {
    const cx = x + 3 * MM;
    const cy = y - pillHeight / 2;
    page.drawEllipse({ x: cx, y: cy, xScale: 1.7 * MM, yScale: 1.7 * MM, borderColor: color(info.tone), borderWidth: 0.7 * MM });
    page.drawLine({ start: { x: cx - 0.7 * MM, y: cy - 0.7 * MM }, end: { x: cx + 0.7 * MM, y: cy + 0.7 * MM }, thickness: 0.6 * MM, color: color(info.tone) });
    page.drawLine({ start: { x: cx + 0.7 * MM, y: cy - 0.7 * MM }, end: { x: cx - 0.7 * MM, y: cy + 0.7 * MM }, thickness: 0.6 * MM, color: color(info.tone) });
  }
  page.drawText(info.label, { x: x + 6 * MM, y: y - pillHeight + 1.15 * MM, font: fonts.bold, size: 8.5, color: color(info.text) });
  return pillWidth;
}

const SECCIONES_REPORTE = [
  { id: 'plan', label: 'Plan de emergencias y procedimientos operativos normalizados', descripcion: 'Riesgos identificados, procedimientos y rutas hacia el punto de encuentro.' },
  { id: 'brigadas', label: 'Conformación de brigadas y asignación de líderes', descripcion: 'Integrantes capacitados en primeros auxilios, evacuación y contra incendios.' },
  { id: 'simulacros', label: 'Registro y evidencia de simulacros de evacuación', descripcion: 'Cumplimiento de la jornada reglamentaria y tiempos de respuesta.' },
  { id: 'inventario', label: 'Inventario de equipos de emergencia y vigencia', descripcion: 'Extintores, botiquines y camillas con estado y fecha de vencimiento/recarga.' },
];

export async function generarReportePdf({ empresa, sedeNombre, desde, hasta, secciones, resumen, emitidoPor }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Reporte de auditoría y cumplimiento SG-SST');
  pdfDoc.setAuthor('ManoAmiga');
  pdfDoc.setSubject('SG-SST');
  pdfDoc.setLanguage('es-CO');
  pdfDoc.setProducer('ManoAmiga');
  pdfDoc.setCreator('ManoAmiga');
  pdfDoc.catalog.set(PDFName.of('Lang'), PDFString.of('es-CO'));

  let fonts;
  try {
    const [regularResponse, boldResponse] = await Promise.all([
      fetch('/fonts/inter-variable.ttf'), fetch('/fonts/poppins-semibold.ttf'),
    ]);
    if (!regularResponse.ok || !boldResponse.ok) throw new Error('Fuentes no disponibles');
    const [regularBytes, boldBytes] = await Promise.all([regularResponse.arrayBuffer(), boldResponse.arrayBuffer()]);
    fonts = {
      regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
      bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
    };
  } catch {
    fonts = {
      regular: await pdfDoc.embedStandardFont('Helvetica'),
      bold: await pdfDoc.embedStandardFont('Helvetica-Bold'),
    };
  }

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawTopBar(page);
  let y = PAGE_HEIGHT - MARGIN_TOP - 4 * MM;

  logo(page, MARGIN_X, y - 12 * MM, 12 * MM);
  const emission = fechaEsCo('', true);
  const headerRight = 'Reporte de auditoría SG-SST';
  const emissionText = `Emitido el ${emission}`;
  page.drawText(headerRight, { x: PAGE_WIDTH - MARGIN_X - fonts.bold.widthOfTextAtSize(headerRight, 9), y: y - 2 * MM, font: fonts.bold, size: 9, color: color(COLORS.navy) });
  page.drawText(emissionText, { x: PAGE_WIDTH - MARGIN_X - fonts.regular.widthOfTextAtSize(emissionText, 8), y: y - 7 * MM, font: fonts.regular, size: 8, color: color(COLORS.muted) });
  y -= 16 * MM;

  page.drawText('Reporte de auditoría y cumplimiento', { x: MARGIN_X, y: y - 22, font: fonts.bold, size: 22, color: color(COLORS.navy) });
  y -= 10 * MM;
  y = drawWrapped(page, 'Sistema de Gestión de la Seguridad y Salud en el Trabajo (SG-SST) · Resolución 0312 de 2019 y Decreto 1072 de 2015', MARGIN_X, y, PAGE_WIDTH - 2 * MARGIN_X, fonts.regular, 10, 14, color(COLORS.muted));
  page.drawRectangle({ x: MARGIN_X, y: y - 1 * MM, width: 24 * MM, height: 0.5 * MM, color: color(COLORS.red) });
  y -= 7 * MM;

  const empresaNombre = empresa?.razonSocial || '';
  const nit = empresa?.nit || '';
  const cardHeight = 38 * MM;
  page.drawRectangle({ x: MARGIN_X, y: y - cardHeight, width: PAGE_WIDTH - 2 * MARGIN_X, height: cardHeight, color: color(COLORS.soft), borderColor: color(COLORS.border), borderWidth: 0.3 * MM });
  const cardInnerX = MARGIN_X + 5 * MM;
  const columnWidth = (PAGE_WIDTH - 2 * MARGIN_X - 10 * MM - 5 * MM) / 2;
  const fields = [
    ['Empresa', empresaNombre], ['NIT', nit], ['Sede auditada', sedeNombre || 'Todas las sedes'],
    ['Periodo auditado', rangoFechas(desde, hasta)], ['Fecha de emisión', emission],
  ];
  if (emitidoPor) fields.push(['Emitido por', emitidoPor]);
  fields.forEach((field, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = cardInnerX + column * (columnWidth + 5 * MM);
    const top = y - 5 * MM - row * 11 * MM;
    page.drawText(field[0].toUpperCase(), { x, y: top - 8, font: fonts.bold, size: 8, color: color(COLORS.muted) });
    drawWrapped(page, field[1], x, top - 10, columnWidth, fonts.bold, 10.5, 14, color(COLORS.text));
  });
  y -= cardHeight + 8 * MM;

  y = drawSectionTitle(page, 1, 'Resumen ejecutivo de cumplimiento', y, fonts);

  const porcentaje = typeof resumen?.porcentajeGlobal === 'number' ? resumen.porcentajeGlobal : null;
  const nivelTexto = resumen?.nivel || '';
  const nivelEstado = porcentaje !== null ? (porcentaje >= 85 ? 'verde' : porcentaje >= 60 ? 'amarillo' : 'rojo') : 'amarillo';
  const levelInfo = stateInfo(nivelEstado);
  const scoreWidth = 38 * MM;
  const scoreHeight = 26 * MM;
  page.drawRectangle({ x: MARGIN_X, y: y - scoreHeight, width: scoreWidth, height: scoreHeight, color: color(COLORS.soft), borderColor: color(COLORS.border), borderWidth: 0.3 * MM });
  if (porcentaje !== null) {
    const pct = `${porcentaje}%`;
    page.drawText(pct, { x: MARGIN_X + (scoreWidth - fonts.bold.widthOfTextAtSize(pct, 28)) / 2, y: y - 14 * MM, font: fonts.bold, size: 28, color: color(levelInfo.text) });
    page.drawText('CUMPLIMIENTO', { x: MARGIN_X + (scoreWidth - fonts.bold.widthOfTextAtSize('CUMPLIMIENTO', 8)) / 2, y: y - 21 * MM, font: fonts.bold, size: 8, color: color(COLORS.muted) });
  }

  const summaryX = MARGIN_X + scoreWidth + 6 * MM;
  const summaryWidth = PAGE_WIDTH - MARGIN_X - summaryX;
  if (nivelTexto) page.drawText(nivelTexto, { x: summaryX, y: y - 8, font: fonts.bold, size: 11, color: color(levelInfo.text) });
  if (porcentaje !== null) {
    const barY = y - 15 * MM;
    page.drawRectangle({ x: summaryX, y: barY, width: summaryWidth, height: 3 * MM, color: color(COLORS.border) });
    page.drawRectangle({ x: summaryX, y: barY, width: summaryWidth * Math.min(100, Math.max(0, porcentaje)) / 100, height: 3 * MM, color: color(levelInfo.tone) });
  }
  y -= scoreHeight + 5 * MM;

  const kpis = [
    { label: 'Sedes auditadas', value: resumen?.totalSedes?.toString() },
    { label: 'Planes aprobados', value: `${resumen?.planesAprobados ?? 0} de ${resumen?.totalSedes ?? 0}` },
    { label: 'Sedes con brigada', value: resumen?.brigadasTexto?.match(/\d+\s+de\s+\d+/)?.[0] || resumen?.totalBrigadas?.toString() },
    { label: 'Equipos registrados', value: resumen?.totalEquipos?.toString() },
  ].filter((kpi) => kpi.value !== undefined);
  if (kpis.length) {
    const gap = 4 * MM;
    const cardWidth = (PAGE_WIDTH - 2 * MARGIN_X - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((kpi, index) => {
      const x = MARGIN_X + index * (cardWidth + gap);
      page.drawRectangle({ x, y: y - 22 * MM, width: cardWidth, height: 22 * MM, color: color(COLORS.white), borderColor: color(COLORS.border), borderWidth: 0.3 * MM });
      page.drawRectangle({ x, y: y - 1.2 * MM, width: cardWidth, height: 1.2 * MM, color: color(COLORS.navy) });
      page.drawText(kpi.value, { x: x + 3 * MM, y: y - 10 * MM, font: fonts.bold, size: 16, color: color(COLORS.navy) });
      page.drawText(kpi.label, { x: x + 3 * MM, y: y - 17 * MM, font: fonts.regular, size: 8, color: color(COLORS.muted) });
    });
    y -= 26 * MM;
  }

  const selected = SECCIONES_REPORTE.filter((section) => secciones.includes(section.id));
  if (selected.length) {
    if (y < MARGIN_BOTTOM + 30 * MM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageHeaderCompact(page, empresa, fonts);
      y = PAGE_HEIGHT - MARGIN_TOP - 12 * MM;
    }
    y = drawSectionTitle(page, 2, 'Secciones y evidencias documentales adjuntas', y, fonts);

    const norms = {
      plan: 'Decreto 1072 de 2015 y Resolución 0312 de 2019',
      brigadas: 'Resolución 0312 de 2019',
      simulacros: 'Decreto 1072 de 2015',
      inventario: 'Resolución 0312 de 2019',
    };

    const tableX = MARGIN_X;
    const tableWidth = PAGE_WIDTH - 2 * MARGIN_X;
    const widths = [tableWidth * 0.38, tableWidth * 0.22, tableWidth * 0.16, tableWidth * 0.24];

    function drawTableHeader(target, topY) {
      const headerHeight = 10 * MM;
      target.drawRectangle({ x: tableX, y: topY - headerHeight, width: tableWidth, height: headerHeight, color: color(COLORS.navy) });
      const labels = ['Sección', 'Norma de referencia', 'Estado', 'Detalle'];
      let x = tableX;
      labels.forEach((label, index) => {
        target.drawText(label, { x: x + 2 * MM, y: topY - 7 * MM, font: fonts.bold, size: 8.5, color: color(COLORS.white) });
        x += widths[index];
      });
      return topY - headerHeight;
    }

    y = drawTableHeader(page, y);
    for (let index = 0; index < selected.length; index += 1) {
      const section = selected[index];
      const estado = sectionState(section.id, resumen);
      const detail = section.descripcion;
      const detailLines = wrapText(detail, fonts.regular, 9.5, widths[3] - 4 * MM);
      const sectionLines = wrapText(section.label, fonts.regular, 9.5, widths[0] - 4 * MM);
      const normLines = wrapText(norms[section.id], fonts.regular, 9.5, widths[1] - 4 * MM);
      const rowHeight = Math.max(14 * MM, (Math.max(sectionLines.length, normLines.length, detailLines.length) * 13) + 6 * MM);

      if (y - rowHeight < MARGIN_BOTTOM + 12 * MM) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageHeaderCompact(page, empresa, fonts);
        y = PAGE_HEIGHT - MARGIN_TOP - 12 * MM;
        y = drawTableHeader(page, y);
      }

      if (index % 2 === 1) page.drawRectangle({ x: tableX, y: y - rowHeight, width: tableWidth, height: rowHeight, color: color(COLORS.soft) });
      let x = tableX;
      page.drawLine({ start: { x: tableX, y: y - rowHeight }, end: { x: tableX + tableWidth, y: y - rowHeight }, thickness: 0.3 * MM, color: color(COLORS.border) });
      drawWrapped(page, section.label, x + 2 * MM, y - 2 * MM, widths[0] - 4 * MM, fonts.regular, 9.5, 13, color(COLORS.text));
      x += widths[0];
      drawWrapped(page, norms[section.id], x + 2 * MM, y - 2 * MM, widths[1] - 4 * MM, fonts.regular, 9.5, 13, color(COLORS.text));
      x += widths[1];
      drawStatePill(page, x + 1.5 * MM, y - 2.5 * MM, estado, fonts);
      x += widths[2];
      drawWrapped(page, detail, x + 2 * MM, y - 2 * MM, widths[3] - 4 * MM, fonts.regular, 9.5, 13, color(COLORS.text));
      y -= rowHeight;
    }
  }

  const declaration = 'Declaro que la información consignada en este reporte corresponde a los registros disponibles del Sistema de Gestión de la Seguridad y Salud en el Trabajo de la organización y se presenta para fines de seguimiento, auditoría y cumplimiento normativo.';
  const signatureBlockHeight = 62 * MM;
  if (y - signatureBlockHeight < MARGIN_BOTTOM) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageHeaderCompact(page, empresa, fonts);
    y = PAGE_HEIGHT - MARGIN_TOP - 12 * MM;
  }

  y = drawSectionTitle(page, 3, 'Declaración y firmas', y, fonts);
  const declarationHeight = 34 * MM;
  page.drawRectangle({ x: MARGIN_X, y: y - declarationHeight, width: PAGE_WIDTH - 2 * MARGIN_X, height: declarationHeight, borderColor: color(COLORS.border), borderWidth: 0.3 * MM, color: color(COLORS.white) });
  drawWrapped(page, declaration, MARGIN_X + 5 * MM, y - 5 * MM, PAGE_WIDTH - 2 * MARGIN_X - 10 * MM, fonts.regular, 9.5, 13.3, color(COLORS.text));
  y -= declarationHeight + 8 * MM;

  const gap = 12 * MM;
  const signatureWidth = (PAGE_WIDTH - 2 * MARGIN_X - gap) / 2;
  const roles = ['Responsable SG-SST', 'Representante legal / Gerencia'];
  roles.forEach((role, index) => {
    const x = MARGIN_X + index * (signatureWidth + gap);
    page.drawLine({ start: { x, y: y - 18 * MM }, end: { x: x + signatureWidth, y: y - 18 * MM }, thickness: 0.4 * MM, color: color(COLORS.text) });
    page.drawText(role, { x: x + (signatureWidth - fonts.bold.widthOfTextAtSize(role, 9)) / 2, y: y - 24 * MM, font: fonts.bold, size: 9, color: color(COLORS.text) });
    ['Nombre:', 'Documento:', 'Fecha:'].forEach((label, lineIndex) => {
      const lineY = y - (30 + lineIndex * 8) * MM;
      page.drawText(label, { x, y: lineY, font: fonts.regular, size: 8, color: color(COLORS.muted) });
      page.drawLine({ start: { x: x + 18 * MM, y: lineY + 2 }, end: { x: x + signatureWidth, y: lineY + 2 }, thickness: 0.3 * MM, color: color(COLORS.border), dashArray: [1, 2] });
    });
  });

  const pages = pdfDoc.getPages();
  pages.forEach((target, index) => {
    if (index > 0) pageHeaderCompact(target, empresa, fonts);
    drawFooter(target, index + 1, pages.length, fonts);
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function nombreArchivoReportePdf(empresa, emissionDate = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Bogota',
  }).format(emissionDate).replace(/-/g, '-');
  const company = limpiarNombreArchivo(empresa?.razonSocial);
  return `ManoAmiga_Reporte_SG-SST_${company}_${date}.pdf`;
}
