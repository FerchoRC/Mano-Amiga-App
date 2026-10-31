import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, CODIGOS_SESION_PERDIDA, setSessionLostHandler, tokenStore } from '../lib/api.js';
import IdleWatcher from './IdleWatcher.jsx';

const AuthContext = createContext(null);

// status: 'loading' | 'authenticated' | 'anonymous' | 'offline'
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    status: tokenStore.get() ? 'loading' : 'anonymous',
    session: null,
    aviso: null,
  }));

  const endSession = useCallback((aviso = null) => {
    tokenStore.clear();
    setState({ status: 'anonymous', session: null, aviso });
  }, []);

  const loadSession = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const session = await api('/api/auth/sesion');
      setState({ status: 'authenticated', session, aviso: null });
    } catch (error) {
      if (error.codigo === 'SIN_CONEXION') {
        setState((s) => ({ ...s, status: 'offline' }));
      } else {
        endSession(CODIGOS_SESION_PERDIDA.has(error.codigo) ? error.message : null);
      }
    }
  }, [endSession]);

  // Restaurar la sesión guardada al abrir la aplicación.
  useEffect(() => {
    if (tokenStore.get()) loadSession();
  }, [loadSession]);

  // Si el backend rechaza el token en cualquier petición, se cierra la sesión.
  useEffect(() => {
    setSessionLostHandler((error) => endSession(error.message));
  }, [endSession]);

  // Cerrar sesión en una pestaña la cierra en las demás.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === tokenStore.key && !event.newValue) endSession();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endSession]);

  const startSession = useCallback(({ token, ...session }) => {
    tokenStore.set(token);
    setState({ status: 'authenticated', session, aviso: null });
  }, []);

  // Actualiza los datos de la sesión vigente (p. ej. tras cambiar la contraseña).
  const updateSession = useCallback((session) => {
    setState((s) => ({ ...s, session }));
  }, []);

  const logout = useCallback(
    async (aviso = null) => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      endSession(aviso);
    },
    [endSession]
  );

  const value = useMemo(
    () => ({
      ...state,
      startSession,
      updateSession,
      logout,
      reload: loadSession,
      clearAviso: () => setState((s) => ({ ...s, aviso: null })),
      can: (permiso) => Boolean(state.session?.permisos.includes(permiso)),
    }),
    [state, startSession, updateSession, logout, loadSession]
  );

  const minutos = state.session?.sesion.inactividadMinutos;

  return (
    <AuthContext value={value}>
      {children}
      {state.status === 'authenticated' && minutos && (
        <IdleWatcher
          minutes={minutos}
          onTimeout={() =>
            logout(
              `Cerramos tu sesión tras ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} sin actividad. Vuelve a ingresar.`
            )
          }
          onLogout={() => logout()}
        />
      )}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
