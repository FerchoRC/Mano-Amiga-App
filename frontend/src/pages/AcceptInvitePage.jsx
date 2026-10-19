import { Link2Off } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { PasswordField, TextField } from '../components/Field.jsx';
import { api } from '../lib/api.js';
import { ROLES } from '../lib/roles.js';
import { limpiarErrores, validarContrasena, validarNombre } from '../lib/validators.js';
import styles from './AuthPages.module.css';
import PasswordRules from './PasswordRules.jsx';

// HU-03: la persona invitada crea su contraseña y entra con el rol asignado.
export default function AcceptInvitePage() {
  const { token } = useParams();
  const { startSession } = useAuth();
  const navigate = useNavigate();

  const [invitacion, setInvitacion] = useState(null);
  const [cargaError, setCargaError] = useState(null);
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/invitaciones/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(({ invitacion }) => {
        setInvitacion(invitacion);
        setNombre(invitacion.nombre);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setCargaError(err.message);
      });
    return () => controller.abort();
  }, [token]);

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      nombre: validarNombre(nombre),
      contrasena: validarContrasena(contrasena),
      confirmacion: confirmacion === contrasena ? null : 'Las contraseñas no coinciden.',
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    setError(null);
    try {
      const data = await api(`/api/invitaciones/${encodeURIComponent(token)}/aceptar`, {
        method: 'POST',
        body: { nombre, contrasena },
      });
      startSession(data);
      navigate('/inicio', { replace: true, state: { bienvenida: 'invitacion' } });
    } catch (err) {
      setErrores(err.campos);
      if (!Object.keys(err.campos).length) setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (cargaError) {
    return (
      <div className={styles.centered}>
        <Link2Off size={28} color="var(--text-subtle)" aria-hidden="true" />
        <h1>Invitación no disponible</h1>
        <p className={styles.lead}>{cargaError}</p>
        <Button variant="secondary" to="/ingresar">
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  if (!invitacion) {
    return (
      <div className={styles.centered} aria-busy="true" style={{ color: 'var(--text-subtle)' }}>
        <span className="spinner" style={{ fontSize: 20 }} />
        <span className="visually-hidden">Cargando invitación</span>
      </div>
    );
  }

  const rol = ROLES[invitacion.rol];
  const RolIcono = rol.icono;

  return (
    <>
      <header className={styles.header}>
        <p className="eyebrow">Invitación</p>
        <h1>Únete a {invitacion.empresa}</h1>
        <p className={styles.lead}>
          {invitacion.invitadoPor ? `${invitacion.invitadoPor} te invitó` : 'Te invitaron'} a ManoAmiga.
          Crea tu contraseña para entrar.
        </p>
      </header>

      <div className={styles.inviteCard}>
        <span className={styles.inviteIcon}>
          <RolIcono size={20} aria-hidden="true" />
        </span>
        <div>
          <p>
            Tu rol: <span className={styles.inviteRole}>{rol.etiqueta}</span>
          </p>
          <ul className={styles.inviteList}>
            {rol.capacidades.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField label="Correo" value={invitacion.correo} readOnly />
        <TextField
          label="Tu nombre completo"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errores.nombre}
        />
        <PasswordField
          label="Crea una contraseña"
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
        <Button type="submit" block loading={enviando}>
          Crear cuenta y entrar
        </Button>
      </form>
    </>
  );
}
