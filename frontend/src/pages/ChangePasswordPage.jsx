import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { PasswordField } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { primerNombre } from '../lib/format.js';
import { limpiarErrores, validarContrasena } from '../lib/validators.js';
import styles from './AuthPages.module.css';
import PasswordRules from './PasswordRules.jsx';

// Cambiar la propia contraseña. Es obligatorio si el administrador la asignó.
export default function ChangePasswordPage() {
  const { session, updateSession } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const obligatorio = session.usuario.debeCambiarContrasena;

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      contrasenaActual: !obligatorio && !actual ? 'Escribe tu contraseña actual.' : null,
      contrasenaNueva: validarContrasena(nueva),
      confirmacion: confirmacion === nueva ? null : 'Las contraseñas no coinciden.',
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    setError(null);
    try {
      const payload = await api('/api/auth/contrasena', {
        method: 'PUT',
        body: { contrasenaActual: obligatorio ? undefined : actual, contrasenaNueva: nueva },
      });
      updateSession(payload);
      toast('Tu contraseña quedó actualizada.');
      navigate('/inicio', { replace: true });
    } catch (err) {
      setErrores(err.campos);
      if (!Object.keys(err.campos).length) setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.narrow}>
      <header className={styles.header}>
        {obligatorio && <p className="eyebrow">Primer ingreso</p>}
        <h1>{obligatorio ? 'Crea tu propia contraseña' : 'Cambiar contraseña'}</h1>
        <p className={styles.lead}>
          {obligatorio
            ? `${primerNombre(session.usuario.nombre)}, tu administrador te dio una contraseña temporal. Elige una nueva que solo tú conozcas.`
            : 'Se cerrarán tus sesiones abiertas en otros dispositivos.'}
        </p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {!obligatorio && (
          <PasswordField
            label="Contraseña actual"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            error={errores.contrasenaActual}
            autoFocus
          />
        )}
        <PasswordField
          label="Nueva contraseña"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={errores.contrasenaNueva}
          hint={<PasswordRules value={nueva} />}
          autoFocus={obligatorio}
        />
        <PasswordField
          label="Confirma la nueva contraseña"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          error={errores.confirmacion}
        />
        <div className={styles.actions}>
          {!obligatorio && (
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          )}
          <Button type="submit" icon={ShieldCheck} loading={enviando} block={obligatorio}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </div>
  );
}
