import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

import styles from './Toast.module.css';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const toast = useCallback((mensaje, { tone = 'success' } = {}) => {
    const id = ++nextId.current;
    setToasts((actuales) => [...actuales.slice(-2), { id, mensaje, tone }]);
    setTimeout(() => setToasts((actuales) => actuales.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext value={toast}>
      {children}
      <div className={styles.region} aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = t.tone === 'error' ? CircleAlert : CircleCheck;
          return (
            <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`} role="status">
              <Icon size={18} aria-hidden="true" />
              <span>{t.mensaje}</span>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
