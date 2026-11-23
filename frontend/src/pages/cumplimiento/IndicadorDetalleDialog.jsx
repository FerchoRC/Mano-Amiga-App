// HU-13: Panel de cumplimiento
// Diálogo de detalle que muestra qué falta para cumplir el indicador seleccionado

import {
  AlertTriangle,
  Award,
  BellRing,
  CheckCircle2,
  FileCheck2,
  Flame,
  MapPin,
  Wrench,
  FileText,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import Alert from '../../components/Alert.jsx';
import styles from './CumplimientoPage.module.css';

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

const ICONOS_INDICADOR = {
  plan_emergencia: FileCheck2,
  brigadas: Flame,
  simulacros: BellRing,
  inventario_equipos: Wrench,
  mapa_evacuacion: MapPin,
};

export default function IndicadorDetalleDialog({ indicador, open, onClose }) {
  const navigate = useNavigate();

  if (!indicador) return null;

  const semaforo = SEMAFOROS[indicador.estado] || SEMAFOROS.amarillo;
  const { Icon: IconoSemaforo } = semaforo;
  const IconoIndicador = ICONOS_INDICADOR[indicador.id] || Award;

  const handleAccion = () => {
    onClose();
    if (indicador.accion?.ruta) {
      navigate(indicador.accion.ruta);
    }
  };

  const footer = (
    <div className={styles.dialogFooterActions}>
      <Button variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
      {indicador.accion && (
        <Button variant="primary" onClick={handleAccion}>
          {indicador.accion.texto}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={indicador.titulo}
      size="md"
      footer={footer}
    >
      <div className={styles.dialogContenido}>
        <div className={styles.dialogIndicadorHeader}>
          <div
            className={`${styles.dialogIconWrapper} ${
              indicador.estado === 'verde'
                ? styles.dialogIconVerde
                : indicador.estado === 'rojo'
                  ? styles.dialogIconRojo
                  : styles.dialogIconAmarillo
            }`}
          >
            <IconoIndicador aria-hidden="true" size={28} strokeWidth={2} />
          </div>
          <div className={styles.dialogHeaderMeta}>
            <span className={`${styles.badge} ${semaforo.className}`}>
              <IconoSemaforo aria-hidden="true" size={14} />
              {semaforo.label} · {indicador.porcentaje}%
            </span>
            <span className={styles.dialogNorma}>
              <FileText aria-hidden="true" size={14} />
              {indicador.norma}
            </span>
            <div
              className={styles.dialogProgreso}
              role="progressbar"
              aria-label={`Progreso de ${indicador.titulo}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={indicador.porcentaje}
            >
              <span
                className={`${styles.dialogRelleno} ${styles[`barra_${indicador.estado}`] || ''}`}
                style={{ width: `${Math.min(100, Math.max(0, indicador.porcentaje))}%` }}
              />
            </div>
          </div>
        </div>

        <Alert
          tone={indicador.estado === 'verde' ? 'success' : indicador.estado === 'rojo' ? 'error' : 'warning'}
          title={indicador.estado === 'verde' ? 'Cumples este requisito' : '¿Qué falta para cumplirlo?'}
        >
          {indicador.queFalta}
        </Alert>

        <div className={styles.checklistSeccion}>
          <h3 className={styles.checklistTitulo}>Detalle</h3>
          <ul className={styles.checkList}>
            {indicador.detalles?.map((item, idx) => (
              <li key={idx} className={styles.checkItem}>
                {item.cumple ? (
                  <CheckCircle2
                    className={styles.iconCumple}
                    aria-hidden="true"
                    size={20}
                  />
                ) : (
                  <AlertTriangle
                    className={styles.iconPendiente}
                    aria-hidden="true"
                    size={20}
                  />
                )}
                <span>{item.texto}</span>
                <span className="visually-hidden">
                  {item.cumple ? 'Cumplido' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
