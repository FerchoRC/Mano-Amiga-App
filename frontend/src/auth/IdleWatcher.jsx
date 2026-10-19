import { Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import Button from '../components/Button.jsx';
import Dialog from '../components/Dialog.jsx';
import { api } from '../lib/api.js';

const ACTIVITY_KEY = 'manoamiga.actividad';
const HEARTBEAT_MS = 2 * 60 * 1000;
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

const heartbeat = () => api('/api/auth/actividad', { method: 'POST' }).catch(() => {});

// HU-02: la sesión expira tras un tiempo de inactividad.
// Mide la actividad real del usuario (compartida entre pestañas), avisa un
// minuto antes y mantiene viva la sesión del servidor con un latido.
export default function IdleWatcher({ minutes, onTimeout, onLogout }) {
  const idleMs = minutes * 60 * 1000;
  const warnMs = Math.min(60 * 1000, idleMs / 4);

  const lastActivity = useRef(Date.now());
  const lastBeat = useRef(Date.now());
  const warning = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const markActivity = () => {
      if (warning.current) return;
      const now = Date.now();
      lastActivity.current = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        /* sin almacenamiento: cada pestaña mide su propia actividad */
      }
      if (now - lastBeat.current > HEARTBEAT_MS) {
        lastBeat.current = now;
        heartbeat();
      }
    };

    const onStorage = (event) => {
      if (event.key === ACTIVITY_KEY && event.newValue) {
        lastActivity.current = Math.max(lastActivity.current, Number(event.newValue));
      }
    };

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleMs) {
        clearInterval(tick);
        onTimeoutRef.current();
      } else if (idle >= idleMs - warnMs) {
        warning.current = true;
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      } else if (warning.current) {
        // Otra pestaña registró actividad mientras se mostraba el aviso.
        warning.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true, capture: true }));
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(tick);
      EVENTS.forEach((e) => window.removeEventListener(e, markActivity, { capture: true }));
      window.removeEventListener('storage', onStorage);
    };
  }, [idleMs, warnMs]);

  const stayConnected = () => {
    warning.current = false;
    lastActivity.current = Date.now();
    lastBeat.current = Date.now();
    try {
      localStorage.setItem(ACTIVITY_KEY, String(lastActivity.current));
    } catch {
      /* ignorado */
    }
    setSecondsLeft(null);
    heartbeat();
  };

  return (
    <Dialog
      open={secondsLeft !== null}
      onClose={stayConnected}
      size="sm"
      title="¿Sigues ahí?"
      description={`Por seguridad cerraremos tu sesión en ${secondsLeft ?? 0} segundos por inactividad.`}
      footer={
        <>
          <Button variant="secondary" onClick={onLogout}>
            Cerrar sesión
          </Button>
          <Button onClick={stayConnected} autoFocus>
            Seguir conectado
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        <Clock size={18} aria-hidden="true" />
        La información de tu empresa queda protegida si dejas el equipo desatendido.
      </div>
    </Dialog>
  );
}
