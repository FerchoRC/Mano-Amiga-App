import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import styles from './Alert.module.css';

const ICONOS = { error: CircleAlert, success: CircleCheck, info: Info, warning: TriangleAlert };

export default function Alert({ tone = 'info', title, children, action }) {
  const Icon = ICONOS[tone];
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
