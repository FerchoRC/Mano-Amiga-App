import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import styles from './Dialog.module.css';

// Diálogo modal sobre <dialog> nativo: foco atrapado y Escape sin librerías.
// En celulares se muestra como hoja inferior.
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[size]}`}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(event) => {
        if (event.target === ref.current && dismissible) onClose?.();
      }}
    >
      {open && (
        <div className={styles.panel}>
          {(title || dismissible) && (
            <header className={styles.header}>
              <div className={styles.heading}>
                {title && (
                  <h2 id={titleId} className={styles.title}>
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descriptionId} className={styles.description}>
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </header>
          )}
          {children ? <div className={styles.body}>{children}</div> : <div className={styles.spacer} />}
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
