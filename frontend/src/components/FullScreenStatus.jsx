import { WifiOff } from 'lucide-react';

import Button from './Button.jsx';
import Logo from './Logo.jsx';

const wrap = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--gutter)',
  textAlign: 'center',
};

export default function FullScreenStatus({ offline = false, onRetry }) {
  if (!offline) {
    return (
      <div style={wrap} aria-busy="true">
        <div style={{ display: 'grid', gap: 20, justifyItems: 'center', color: 'var(--text-subtle)' }}>
          <Logo height={34} />
          <span className="spinner" style={{ fontSize: 20 }} />
          <span className="visually-hidden">Cargando</span>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', maxWidth: 360 }}>
        <WifiOff size={28} color="var(--text-subtle)" aria-hidden="true" />
        <h1 style={{ fontSize: 22 }}>Sin conexión con el servidor</h1>
        <p className="muted">
          No pudimos verificar tu sesión. Revisa tu conexión a internet e intenta de nuevo.
        </p>
        <Button onClick={onRetry}>Reintentar</Button>
      </div>
    </div>
  );
}
