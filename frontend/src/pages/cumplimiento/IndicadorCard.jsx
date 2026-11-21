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
import Button from '../../components/Button.jsx';
import styles from './CumplimientoPage.module.css';

const ICONOS = {
  plan_emergencia: FileCheck,
  brigadas: Flame,
  simulacros: BellRing,
  inventario_equipos: Wrench,
  mapa_evacuacion: MapPin,
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

        <div className={styles.progresoBloque}>
          <div className={styles.progresoCabecera}>
            <span className={styles.porcentajeTexto}>{indicador.porcentaje}%</span>
            <p className={styles.cardResumen}>{indicador.resumen}</p>
          </div>
          <div
            className={styles.barraFondo}
            role="progressbar"
            aria-label={`Progreso de ${indicador.titulo}`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={indicador.porcentaje}
          >
            <span
              className={styles.barraRelleno}
              style={{ width: `${Math.min(100, Math.max(0, indicador.porcentaje))}%` }}
            />
          </div>
        </div>

      </div>

      <footer className={styles.cardFooter}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.btnVerQueFalta}
          onClick={() => onClick(indicador)}
          aria-label={`Ver qué falta para cumplir ${indicador.titulo}`}
        >
          <span>Ver qué falta</span>
          <ChevronRight aria-hidden="true" size={16} />
        </Button>
      </footer>
    </article>
  );
}
