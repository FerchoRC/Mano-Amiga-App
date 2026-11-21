// HU-13: Panel de cumplimiento
// Tarjeta individual para cada indicador del panel con semáforo (verde, amarillo, rojo)

import {
  AlertTriangle,
  Award,
  BellRing,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Flame,
  HelpCircle,
  MapPin,
  Wrench,
  XCircle,
} from 'lucide-react';
import styles from './CumplimientoPage.module.css';

const ICONOS = {
  plan_emergencia: FileCheck,
  plan: FileCheck,
  brigadas: Flame,
  simulacros: BellRing,
  inventario_equipos: Wrench,
  equipos: Wrench,
  mapa_evacuacion: MapPin,
  mapa: MapPin,
};

const SEMAFOROS = {
  verde: {
    label: 'Cumplido',
    className: styles.badgeVerde,
    Icon: CheckCircle2,
  },
  amarillo: {
    label: 'En progreso',
    className: styles.badgeAmarillo,
    Icon: AlertTriangle,
  },
  rojo: {
    label: 'Crítico',
    className: styles.badgeRojo,
    Icon: XCircle,
  },
};

export default function IndicadorCard({ indicador, onClick }) {
  const IconoIndicador = ICONOS[indicador.id] || Award;
  const semaforo = SEMAFOROS[indicador.estado] || {
    label: 'Desconocido',
    className: styles.badgeGris,
    Icon: HelpCircle,
  };
  const { Icon: IconoSemaforo } = semaforo;

  return (
    <article
      className={`${styles.card} ${styles[`card_${indicador.estado}`] || ''}`}
      onClick={() => onClick(indicador)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(indicador);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${indicador.titulo}: ${semaforo.label}, ${indicador.porcentaje}%`}
    >
      <header className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          <IconoIndicador aria-hidden="true" size={24} />
        </div>
        <span className={`${styles.badge} ${semaforo.className}`}>
          <IconoSemaforo aria-hidden="true" size={14} />
          {semaforo.label}
        </span>
      </header>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitulo}>{indicador.titulo}</h3>
        <p className={styles.cardNorma}>{indicador.norma}</p>

        <div className={styles.progresoWrapper}>
          <div className={styles.barraFondo}>
            <div
              className={`${styles.barraRelleno} ${styles[`barra_${indicador.estado}`] || ''}`}
              style={{ width: `${Math.min(100, Math.max(0, indicador.porcentaje))}%` }}
            />
          </div>
          <span className={styles.porcentajeTexto}>{indicador.porcentaje}%</span>
        </div>

        <p className={styles.cardResumen}>{indicador.resumen}</p>
      </div>

      <footer className={styles.cardFooter}>
        <span className={styles.btnVerQueFalta}>
          Ver qué falta
          <ChevronRight aria-hidden="true" size={16} />
        </span>
      </footer>
    </article>
  );
}
