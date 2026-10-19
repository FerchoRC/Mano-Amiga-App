import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';

import styles from './Field.module.css';

// Envoltura común: etiqueta, ayuda y error enlazados por aria-describedby.
function FieldShell({ id, label, hint, error, optional, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}>Opcional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <div id={`${id}-hint`} className={styles.hint}>
            {hint}
          </div>
        )
      )}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const TextField = forwardRef(function TextField(
  { label, hint, error, optional, end, id: idProp, className = '', ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className={styles.control}>
        <input
          ref={ref}
          id={id}
          className={`${styles.input} ${end ? styles.hasEnd : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
        />
        {end && <div className={styles.end}>{end}</div>}
      </div>
    </FieldShell>
  );
});

export const TextArea = forwardRef(function TextArea(
  { label, hint, error, optional, id: idProp, className = '', rows = 3, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={`${styles.input} ${styles.textarea} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </FieldShell>
  );
});

export const PasswordField = forwardRef(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      {...props}
      end={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      }
    />
  );
});

export const SelectField = forwardRef(function SelectField(
  { label, hint, error, id: idProp, children, className = '', ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        ref={ref}
        id={id}
        className={`${styles.input} ${styles.select} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export function Checkbox({ label, error, id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.checkbox}>
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
