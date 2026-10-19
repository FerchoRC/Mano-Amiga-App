import styles from './StatusBadge.module.css';

const ESTADOS = {
  activo: { texto: 'Activo', clase: styles.activo },
  pendiente: { texto: 'Invitación pendiente', clase: styles.pendiente },
  inactivo: { texto: 'Inactivo', clase: styles.inactivo },
};

// Semáforo de la marca: verde vigente, naranja en espera, gris sin acceso.
export default function StatusBadge({ estado }) {
  const { texto, clase } = ESTADOS[estado] ?? ESTADOS.inactivo;
  return (
    <span className={`${styles.badge} ${clase}`}>
      <span className={styles.dot} aria-hidden="true" />
      {texto}
    </span>
  );
}
