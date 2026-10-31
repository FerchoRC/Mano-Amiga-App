import { useEffect, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { api } from '../../lib/api.js';
import { primerNombre } from '../../lib/format.js';
import { generarContrasena } from '../../lib/password.js';
import { validarContrasena } from '../../lib/validators.js';
import Credentials from './Credentials.jsx';
import TemporaryPasswordFields from './TemporaryPasswordFields.jsx';

// El administrador asigna una contraseña nueva a otra persona: si la olvidó o
// si tenía una invitación pendiente y prefiere entregarle el acceso directamente.
export default function ResetPasswordDialog({ usuario, onClose, onUpdated }) {
  const [contrasena, setContrasena] = useState(generarContrasena);
  const [debeCambiar, setDebeCambiar] = useState(true);
  const [errorCampo, setErrorCampo] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  // Cada vez que se abre para otra persona, el formulario empieza de cero.
  useEffect(() => {
    if (!usuario) return;
    setContrasena(generarContrasena());
    setDebeCambiar(true);
    setErrorCampo(null);
    setError(null);
    setListo(false);
  }, [usuario]);

  if (!usuario) return <Dialog open={false} />;

  const pendiente = usuario.estado === 'pendiente';

  async function onSubmit(event) {
    event.preventDefault();
    const invalida = validarContrasena(contrasena);
    setErrorCampo(invalida);
    if (invalida) return;

    setEnviando(true);
    setError(null);
    try {
      const res = await api(`/api/usuarios/${usuario.id}/contrasena`, {
        method: 'POST',
        body: { contrasena, debeCambiarContrasena: debeCambiar },
      });
      onUpdated(res.usuario);
      setListo(true);
    } catch (err) {
      if (err.campos.contrasena) setErrorCampo(err.campos.contrasena);
      else setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <Dialog open onClose={onClose} title="Contraseña asignada" footer={<Button onClick={onClose}>Listo</Button>}>
        <Credentials
          nombre={usuario.nombre}
          correo={usuario.correo}
          contrasena={contrasena}
          debeCambiar={debeCambiar}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={pendiente ? `Dar acceso a ${primerNombre(usuario.nombre)}` : `Restablecer contraseña de ${primerNombre(usuario.nombre)}`}
      description={
        pendiente
          ? 'Su invitación dejará de funcionar y podrá entrar con esta contraseña.'
          : 'Se cerrarán sus sesiones abiertas y deberá entrar con la contraseña nueva.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="contrasena-form" loading={enviando}>
            {pendiente ? 'Dar acceso' : 'Restablecer'}
          </Button>
        </>
      }
    >
      <form id="contrasena-form" onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: 18 }}>
        {error && <Alert tone="error">{error}</Alert>}
        <TemporaryPasswordFields
          contrasena={contrasena}
          onContrasena={(valor) => {
            setContrasena(valor);
            setErrorCampo(null);
          }}
          debeCambiar={debeCambiar}
          onDebeCambiar={setDebeCambiar}
          error={errorCampo}
        />
      </form>
    </Dialog>
  );
}
