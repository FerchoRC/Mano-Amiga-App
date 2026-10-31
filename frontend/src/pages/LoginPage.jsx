import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { PasswordField, TextField } from '../components/Field.jsx';
import { api } from '../lib/api.js';
import { limpiarErrores } from '../lib/validators.js';
import styles from './AuthPages.module.css';

// Coinciden con backend/src/db/seed.js
const CUENTAS_DEMO = [
  { rol: 'Administrador', correo: 'admin@demo.co' },
  { rol: 'Brigadista', correo: 'brigadista@demo.co' },
  { rol: 'Empleado', correo: 'empleado@demo.co' },
];
const CONTRASENA_DEMO = 'ManoAmiga2026';

// HU-02: inicio de sesión con correo y contraseña.
export default function LoginPage() {
  const { startSession, aviso, clearAviso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // El aviso (p. ej. sesión cerrada por inactividad) se muestra una sola vez.
  const [avisoSesion] = useState(aviso);
  const clearAvisoRef = useRef(clearAviso);
  useEffect(() => {
    if (avisoSesion) clearAvisoRef.current();
  }, [avisoSesion]);

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const correoRef = useRef(null);
  const contrasenaRef = useRef(null);

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      correo: correo.trim() ? null : 'Escribe tu correo.',
      contrasena: contrasena ? null : 'Escribe tu contraseña.',
    });
    setErrores(nuevos);
    if (nuevos.correo) return correoRef.current?.focus();
    if (nuevos.contrasena) return contrasenaRef.current?.focus();

    setEnviando(true);
    setError(null);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { correo, contrasena } });
      startSession(data);
      navigate(location.state?.from ?? '/inicio', { replace: true });
    } catch (err) {
      setError(err.message);
      setContrasena('');
      contrasenaRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <header className={styles.header}>
        <h1>Inicia sesión</h1>
        <p className={styles.lead}>Accede a la información de emergencias de tu empresa.</p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {avisoSesion && !error && <Alert tone="info">{avisoSesion}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          ref={correoRef}
          label="Correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="nombre@empresa.co"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
          autoFocus
        />
        <PasswordField
          ref={contrasenaRef}
          label="Contraseña"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={errores.contrasena}
        />

        <Button type="submit" block loading={enviando}>
          Ingresar
        </Button>
      </form>

      <p className={styles.switch}>
        ¿Tu empresa aún no está en ManoAmiga? <Link to="/registro">Regístrala</Link>
      </p>

      {import.meta.env.DEV && (
        <div className={styles.demo}>
          <p className={styles.demoTitle}>
            Cuentas de demostración · contraseña <strong>{CONTRASENA_DEMO}</strong>
          </p>
          <div className={styles.demoList}>
            {CUENTAS_DEMO.map((cuenta) => (
              <Button
                key={cuenta.correo}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCorreo(cuenta.correo);
                  setContrasena(CONTRASENA_DEMO);
                  setErrores({});
                }}
              >
                {cuenta.rol}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
