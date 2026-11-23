// HU-12: el backend arma el PDF (GET /api/reportes/auditoria); aquí se pide y se descarga.
import { api } from './api.js';

export const SECCIONES_REPORTE = [
  {
    id: 'plan',
    label: 'Plan de emergencias',
    descripcion: 'Versión vigente al cierre del periodo: riesgos, procedimientos y puntos de encuentro.',
  },
  {
    id: 'brigadas',
    label: 'Brigadas',
    descripcion: 'Primeros auxilios, evacuación y contra incendios, con su líder e integrantes.',
  },
  {
    id: 'simulacros',
    label: 'Simulacros de evacuación',
    descripcion: 'Los realizados en el periodo, con participantes, tiempos y plan de mejora.',
  },
  {
    id: 'inventario',
    label: 'Inventario de equipos',
    descripcion: 'Extintores, botiquines y camillas con su vencimiento y estado actual.',
  },
];

export async function descargarReporteAuditoria({ sedeId, desde, hasta, secciones }) {
  const query = new URLSearchParams({ desde, hasta, secciones: secciones.join(',') });
  if (sedeId) query.set('sedeId', sedeId);

  const { blob, nombre } = await api(`/api/reportes/auditoria?${query}`, { archivo: true });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
