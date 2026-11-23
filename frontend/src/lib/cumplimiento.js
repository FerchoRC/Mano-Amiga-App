// HU-13: el backend calcula los indicadores con los datos reales de la empresa
// (GET /api/cumplimiento). Aquí solo se consultan y se traducen a la interfaz.
import { api } from './api.js';

// Estado general a partir del porcentaje global (mismo criterio que el PDF).
export function nivelGlobal(porcentaje) {
  if (porcentaje >= 85) return { estado: 'verde', titulo: 'Nivel de cumplimiento óptimo' };
  if (porcentaje >= 60) return { estado: 'amarillo', titulo: 'Cumplimiento aceptable, con pendientes' };
  return { estado: 'rojo', titulo: 'Nivel crítico: requiere atención prioritaria' };
}

export function obtenerCumplimiento({ sedeId = null, signal } = {}) {
  const query = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : '';
  return api(`/api/cumplimiento${query}`, { signal });
}
