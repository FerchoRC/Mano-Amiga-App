import { FileCheck2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { Checkbox } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { primerNombre } from '../../lib/format.js';
import styles from '../AuthPages.module.css';

// Ley 1581: quien recibió una cuenta creada por el administrador (o cuando cambia la
// política) acepta el tratamiento de sus datos antes de usar la plataforma.
export default function ConsentimientoPage() {
  const { session, updateSession, logout } = useAuth();
  const navigate = useNavigate();
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (!acepta) {
      setError('Para usar ManoAmiga debes aceptar la política de tratamiento de datos.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      updateSession(await api('/api/auth/consentimiento', { method: 'POST', body: { acepta: true } }));
      navigate('/inicio', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.narrow}>
      <header className={styles.header}>
        <p className="eyebrow">Antes de continuar</p>
        <h1>Tus datos personales</h1>
        <p className={styles.lead}>
          {primerNombre(session.usuario.nombre)}, {session.empresa.razonSocial} usa ManoAmiga para
          avisarte de emergencias y saber si estás a salvo. Para eso guarda tu nombre, correo, sede y
          tu estado durante una emergencia.
        </p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Checkbox
          checked={acepta}
          onChange={(e) => {
            setAcepta(e.target.checked);
            setError(null);
          }}
          label={
            <>
              Autorizo el tratamiento de mis datos según la{' '}
              <Link to="/politica-de-datos" target="_blank" rel="noopener">
                política de tratamiento de datos
              </Link>{' '}
              (Ley 1581 de 2012).
            </>
          }
        />
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => logout()}>
            Salir
          </Button>
          <Button type="submit" icon={FileCheck2} loading={enviando}>
            Aceptar y continuar
          </Button>
        </div>
      </form>
    </div>
  );
}
