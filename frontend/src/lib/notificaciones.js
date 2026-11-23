// HU-09: aviso del sistema operativo cuando llega una alerta y la pestaña de ManoAmiga
// está en segundo plano. Solo funciona con la página abierta (para avisar con la página
// cerrada se necesitaría Web Push); el correo de alerta cubre ese caso.
import { tipoEmergencia } from './alertas.js';

export const notificacionesSoportadas = () => typeof window !== 'undefined' && 'Notification' in window;

export const permisoNotificaciones = () => (notificacionesSoportadas() ? Notification.permission : 'denied');

export async function pedirPermisoNotificaciones() {
  if (!notificacionesSoportadas()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function avisarEmergencia(alerta) {
  if (permisoNotificaciones() !== 'granted' || document.visibilityState === 'visible') return;
  try {
    const aviso = new Notification(`Emergencia: ${tipoEmergencia(alerta.tipo).etiqueta} · ${alerta.sedeNombre}`, {
      body: alerta.instrucciones,
      tag: `alerta-${alerta.id}`,
      requireInteraction: true,
    });
    aviso.onclick = () => {
      window.focus();
      window.location.assign('/inicio');
      aviso.close();
    };
  } catch {
    // Algunos navegadores móviles solo permiten avisos desde un service worker.
  }
}
