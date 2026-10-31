import { Check, Dot } from 'lucide-react';

import { reglasContrasena } from '../lib/validators.js';
import styles from './AuthPages.module.css';

export default function PasswordRules({ value }) {
  return (
    <ul className={styles.rules} aria-label="Requisitos de la contraseña">
      {reglasContrasena(value).map((regla) => (
        <li key={regla.id} className={`${styles.rule} ${regla.cumple ? styles.ruleOk : ''}`}>
          {regla.cumple ? <Check size={14} aria-hidden="true" /> : <Dot size={14} aria-hidden="true" />}
          {regla.texto}
          <span className="visually-hidden">{regla.cumple ? ' (cumple)' : ' (pendiente)'}</span>
        </li>
      ))}
    </ul>
  );
}
