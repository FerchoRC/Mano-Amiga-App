import { Wand2 } from 'lucide-react';

import { Checkbox, TextField } from '../../components/Field.jsx';
import { generarContrasena } from '../../lib/password.js';
import PasswordRules from '../PasswordRules.jsx';
import styles from './Team.module.css';

// Contraseña que el administrador asigna a otra persona. Se muestra en claro
// porque el administrador tiene que comunicarla.
export default function TemporaryPasswordFields({
  contrasena,
  onContrasena,
  debeCambiar,
  onDebeCambiar,
  error,
}) {
  return (
    <div className={styles.passwordBlock}>
      <TextField
        label="Contraseña"
        autoComplete="new-password"
        autoCapitalize="none"
        spellCheck={false}
        className={styles.passwordInput}
        value={contrasena}
        onChange={(e) => onContrasena(e.target.value)}
        error={error}
        hint={<PasswordRules value={contrasena} />}
        end={
          <button
            type="button"
            className={styles.generate}
            onClick={() => onContrasena(generarContrasena())}
          >
            <Wand2 size={15} aria-hidden="true" />
            Generar
          </button>
        }
      />
      <Checkbox
        checked={debeCambiar}
        onChange={(e) => onDebeCambiar(e.target.checked)}
        label="Pedir que la cambie por una propia en su primer ingreso (recomendado)"
      />
    </div>
  );
}
