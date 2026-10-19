import { Navigate, Outlet, useLocation } from 'react-router';

import FullScreenStatus from '../components/FullScreenStatus.jsx';
import ForbiddenView from '../pages/ForbiddenView.jsx';
import { useAuth } from './AuthProvider.jsx';

function SessionGate({ children }) {
  const { status, reload } = useAuth();
  if (status === 'loading') return <FullScreenStatus />;
  if (status === 'offline') return <FullScreenStatus offline onRetry={reload} />;
  return children;
}

export const RUTA_CAMBIAR_CONTRASENA = '/cambiar-contrasena';

export function RequireAuth() {
  const { status, session } = useAuth();
  const location = useLocation();

  // Con contraseña temporal solo se puede ir a crear la propia.
  const debeCambiar =
    session?.usuario.debeCambiarContrasena && location.pathname !== RUTA_CAMBIAR_CONTRASENA;

  return (
    <SessionGate>
      {status !== 'authenticated' ? (
        <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
      ) : debeCambiar ? (
        <Navigate to={RUTA_CAMBIAR_CONTRASENA} replace />
      ) : (
        <Outlet />
      )}
    </SessionGate>
  );
}

// Para /ingresar y /registro: quien ya tiene sesión va directo a su inicio.
export function GuestOnly() {
  const { status } = useAuth();
  return <SessionGate>{status === 'authenticated' ? <Navigate to="/inicio" replace /> : <Outlet />}</SessionGate>;
}

// HU-03: cada rol solo ve lo que le corresponde.
export function RequirePermission({ permiso, children }) {
  const { can } = useAuth();
  return can(permiso) ? children : <ForbiddenView />;
}
