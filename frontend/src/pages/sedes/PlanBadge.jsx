import styles from '../../components/StatusBadge.module.css';

// Estado del plan de emergencias de una sede, con el semáforo de la marca.
export default function PlanBadge({ plan }) {
  if (plan.estado === 'aprobado') {
    return (
      <span className={`${styles.badge} ${styles.activo}`}>
        <span className={styles.dot} aria-hidden="true" />
        Plan aprobado · v{plan.versionVigente}
      </span>
    );
  }
  if (plan.estado === 'borrador') {
    return (
      <span className={`${styles.badge} ${styles.pendiente}`}>
        <span className={styles.dot} aria-hidden="true" />
        Plan en borrador
      </span>
    );
  }
  return (
    <span className={`${styles.badge} ${styles.inactivo}`}>
      <span className={styles.dot} aria-hidden="true" />
      Sin plan
    </span>
  );
}
