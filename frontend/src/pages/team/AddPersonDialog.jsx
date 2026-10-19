import { KeyRound, Send } from 'lucide-react';
import { useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { TextField } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { generarContrasena } from '../../lib/password.js';
import { LISTA_ROLES } from '../../lib/roles.js';
import {
  limpiarErrores,
  validarContrasena,
  validarCorreo,
  validarNombre,
} from '../../lib/validators.js';
import Credentials from './Credentials.jsx';
import InviteLink from './InviteLink.jsx';
import styles from './Team.module.css';
import TemporaryPasswordFields from './TemporaryPasswordFields.jsx';

const MODOS = [
  { id: 'crear', texto: 'Crear acceso', icono: KeyRound },
  { id: 'invitar', texto: 'Enviar invitación', icono: Send },
];

const vacio = () => ({
  nombre: '',
  correo: '',
  rol: 'empleado',
  contrasena: generarContrasena(),
  debeCambiar: true,
});

// HU-03: el administrador agrega personas. Por defecto crea la cuenta con una
// contraseña que entrega él mismo; también puede enviar un enlace de invitación.
export default function AddPersonDialog({ open, onClose, onAdded }) {
  const [modo, setModo] = useState('crear');
  const [datos, setDatos] = useState(vacio);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const reiniciar = () => {
    setDatos(vacio());
    setErrores({});
    setError(null);
    setResultado(null);
  };

  const cerrar = () => {
    onClose();
    reiniciar();
  };

  const set = (campo) => (valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: null }));
  };

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      nombre: validarNombre(datos.nombre),
      correo: validarCorreo(datos.correo),
      contrasena: modo === 'crear' ? validarContrasena(datos.contrasena) : null,
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    const { nombre, correo, rol, contrasena, debeCambiar } = datos;
    setEnviando(true);
    setError(null);
    try {
      const res =
        modo === 'crear'
          ? await api('/api/usuarios', {
              method: 'POST',
              body: { nombre, correo, rol, contrasena, debeCambiarContrasena: debeCambiar },
            })
          : await api('/api/usuarios/invitaciones', {
              method: 'POST',
              body: { nombre, correo, rol },
            });
      setResultado({ ...res, modo, contrasena, debeCambiar });
      onAdded(res.usuario);
    } catch (err) {
      setErrores(err.campos);
      if (!Object.keys(err.campos).length) setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <Dialog
        open={open}
        onClose={cerrar}
        title={resultado.modo === 'crear' ? 'Usuario creado' : 'Invitación lista'}
        footer={
          <>
            <Button variant="secondary" onClick={reiniciar}>
              Agregar a otra persona
            </Button>
            <Button onClick={cerrar}>Listo</Button>
          </>
        }
      >
        {resultado.modo === 'crear' ? (
          <Credentials
            nombre={resultado.usuario.nombre}
            correo={resultado.usuario.correo}
            contrasena={resultado.contrasena}
            debeCambiar={resultado.debeCambiar}
          />
        ) : (
          <InviteLink
            nombre={resultado.usuario.nombre}
            correo={resultado.usuario.correo}
            enlace={resultado.enlace}
            correoEnviado={resultado.correoEnviado}
            expiraEn={resultado.usuario.invitacionExpiraEn}
          />
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={cerrar}
      title="Agregar persona"
      description={
        modo === 'crear'
          ? 'Crea su cuenta ahora y entrégale el correo y la contraseña para que entre.'
          : 'Recibirá un enlace para crear su propia contraseña.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="agregar-form" loading={enviando}>
            {modo === 'crear' ? 'Crear usuario' : 'Crear invitación'}
          </Button>
        </>
      }
    >
      <form id="agregar-form" className={styles.inviteForm} onSubmit={onSubmit} noValidate>
        <div className={styles.modeSwitch} role="group" aria-label="Cómo dar acceso">
          {MODOS.map(({ id, texto, icono: Icono }) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => {
                setModo(id);
                setErrores({});
              }}
            >
              <Icono size={16} aria-hidden="true" />
              {texto}
            </button>
          ))}
        </div>

        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre completo"
          autoComplete="off"
          value={datos.nombre}
          onChange={(e) => set('nombre')(e.target.value)}
          error={errores.nombre}
          autoFocus
        />
        <TextField
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="nombre@empresa.co"
          value={datos.correo}
          onChange={(e) => set('correo')(e.target.value)}
          error={errores.correo}
          hint={modo === 'crear' ? 'Con este correo iniciará sesión.' : undefined}
        />

        <fieldset className={styles.roles}>
          <legend className={styles.rolesLegend}>Rol</legend>
          {LISTA_ROLES.map((rol) => {
            const Icono = rol.icono;
            return (
              <label key={rol.id} className={styles.roleOption}>
                <input
                  type="radio"
                  name="rol"
                  value={rol.id}
                  checked={datos.rol === rol.id}
                  onChange={(e) => set('rol')(e.target.value)}
                />
                <span className={styles.roleOptionIcon}>
                  <Icono size={18} aria-hidden="true" />
                </span>
                <span className={styles.roleOptionText}>
                  <span className={styles.roleOptionName}>{rol.etiqueta}</span>
                  <span className={styles.roleOptionDesc}>{rol.resumen}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {modo === 'crear' && (
          <TemporaryPasswordFields
            contrasena={datos.contrasena}
            onContrasena={set('contrasena')}
            debeCambiar={datos.debeCambiar}
            onDebeCambiar={set('debeCambiar')}
            error={errores.contrasena}
          />
        )}
      </form>
    </Dialog>
  );
}
