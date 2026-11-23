import { ArrowLeft, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { TextField } from '../components/Field.jsx';
import { api } from '../lib/api.js';
import { limpiarErrores, validarCorreo } from '../lib/validators.js';
import styles from './AuthPages.module.css';

// Pedir un enlace para crear una nueva contraseña. La respuesta es la misma exista o no
// la cuenta, para no revelar qué correos están registrados.
export default function RecuperarPage() {
  const location = useLocation();
  const [correo, setCorreo] = useState(location.state?.correo ?? '');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({ correo: validarCorreo(correo) });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    setError(null);
    try {
      await api('/api/auth/recuperar', { method: 'POST', body: { correo } });
      setEnviado(true);
    } catch (err) {
      setErrores(err.campos);
      if (!Object.keys(err.campos).length) setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <>
        <header className={styles.header}>
          <MailCheck size={28} aria-hidden="true" className={styles.icono} />
          <h1>Revisa tu correo</h1>
          <p className={styles.lead}>
            Si <strong>{correo}</strong> tiene una cuenta en ManoAmiga, te enviamos un enlace para crear
            una nueva contraseña. Vence en una hora.
          </p>
        </header>
        <p className={styles.switch}>
          ¿No llegó? Revisa la carpeta de spam o{' '}
          <button type="button" className={styles.linkButton} onClick={() => setEnviado(false)}>
            pide otro enlace
          </button>
          . Si sigue sin llegar, el administrador de tu empresa puede restablecer tu contraseña.
        </p>
        <p className={styles.switch}>
          <Link to="/ingresar">Volver a iniciar sesión</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <h1>Recupera tu contraseña</h1>
        <p className={styles.lead}>Escribe el correo con el que entras y te enviaremos un enlace.</p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
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
        <div className={styles.actions}>
          <Button variant="secondary" icon={ArrowLeft} to="/ingresar" aria-label="Volver a iniciar sesión" />
          <Button type="submit" loading={enviando}>
            Enviar enlace
          </Button>
        </div>
      </form>
    </>
  );
}
