import { Link2Off, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { PasswordField, TextField } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { limpiarErrores, validarContrasena } from '../lib/validators.js';
import styles from './AuthPages.module.css';
import PasswordRules from './PasswordRules.jsx';

// Crear una nueva contraseña desde el enlace del correo. Al guardarla se cierran las
// demás sesiones y la persona entra directamente.
export default function NuevaContrasenaPage() {
  const { token } = useParams();
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [cuenta, setCuenta] = useState(null);
  const [cargaError, setCargaError] = useState(null);
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/auth/recuperar/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(setCuenta)
      .catch((err) => err.name !== 'AbortError' && setCargaError(err.message));
    return () => controller.abort();
  }, [token]);

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      contrasena: validarContrasena(contrasena),
      confirmacion: confirmacion === contrasena ? null : 'Las contraseñas no coinciden.',
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    setError(null);
    try {
      const data = await api(`/api/auth/recuperar/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: { contrasena },
      });
      startSession(data);
      toast('Tu nueva contraseña quedó guardada.');
      navigate('/inicio', { replace: true });
    } catch (err) {
      setErrores(err.campos);
      if (!Object.keys(err.campos).length) setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (cargaError) {
    return (
      <>
        <header className={styles.header}>
          <Link2Off size={28} aria-hidden="true" className={styles.icono} />
          <h1>El enlace no sirve</h1>
          <p className={styles.lead}>{cargaError}</p>
        </header>
        <Button to="/recuperar" block>
          Pedir un enlace nuevo
        </Button>
      </>
    );
  }

  if (!cuenta) {
    return (
      <div aria-busy="true" className={styles.cargando}>
        <span className="spinner" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <h1>Crea una nueva contraseña</h1>
        <p className={styles.lead}>Al guardarla se cerrarán tus sesiones abiertas en otros dispositivos.</p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField label="Correo" value={cuenta.correo} readOnly autoComplete="username" />
        <PasswordField
          label="Nueva contraseña"
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={errores.contrasena}
          hint={<PasswordRules value={contrasena} />}
          autoFocus
        />
        <PasswordField
          label="Confirma la contraseña"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          error={errores.confirmacion}
        />
        <Button type="submit" block icon={ShieldCheck} loading={enviando}>
          Guardar y entrar
        </Button>
      </form>
    </>
  );
}
