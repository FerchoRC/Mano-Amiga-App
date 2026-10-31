import { Lock } from 'lucide-react';

import { useAuth } from '../auth/AuthProvider.jsx';
import Button from '../components/Button.jsx';
import { etiquetaRol } from '../lib/roles.js';

// HU-03: lo que ve un rol cuando intenta entrar a una sección que no le corresponde.
export default function ForbiddenView() {
  const { session } = useAuth();

  return (
    <div style={{ display: 'grid', justifyItems: 'start', gap: 16, maxWidth: 460, paddingTop: 24 }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#EEF0F3',
          color: 'var(--text-muted)',
        }}
      >
        <Lock size={22} aria-hidden="true" />
      </span>
      <h1>Esta sección no está disponible para tu rol</h1>
      <p className="muted">
        Como {etiquetaRol(session?.usuario.rol).toLowerCase()} no tienes acceso aquí. Si crees que lo
        necesitas, habla con el administrador de tu empresa.
      </p>
      <Button variant="secondary" to="/inicio">
        Volver al inicio
      </Button>
    </div>
  );
}
