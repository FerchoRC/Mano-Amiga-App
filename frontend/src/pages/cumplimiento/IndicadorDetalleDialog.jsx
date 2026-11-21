// HU-13: Panel de cumplimiento
// Diálogo de detalle que muestra qué falta para cumplir el indicador seleccionado

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
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

export default function IndicadorDetalleDialog({ indicador, open, onClose }) {
  const navigate = useNavigate();

  if (!indicador) return null;

  const semaforo = SEMAFOROS[indicador.estado] || SEMAFOROS.amarillo;
  const { Icon: IconoSemaforo } = semaforo;

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
        <Button
          variant="primary"
          onClick={handleAccion}
          icon={ArrowRight}
        >
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
        <div className={styles.dialogHeaderMeta}>
          <span className={`${styles.badge} ${semaforo.className}`}>
            <IconoSemaforo aria-hidden="true" size={14} />
            {semaforo.label} ({indicador.porcentaje}%)
          </span>
          <span className={styles.dialogNorma}>
            <FileText aria-hidden="true" size={14} />
            {indicador.norma}
          </span>
        </div>

        {/* Sección destacada: Qué falta para cumplirlo */}
        <div
          className={`${styles.alertaQueFalta} ${
            indicador.estado === 'verde' ? styles.alertaVerde : styles.alertaPendiente
          }`}
        >
          <div className={styles.alertaTitulo}>
            <strong>
              {indicador.estado === 'verde' ? 'Estado actual' : '¿Qué falta para cumplirlo?'}
            </strong>
          </div>
          <p className={styles.alertaTexto}>{indicador.queFalta}</p>
        </div>

        {/* Lista de chequeo */}
        <div className={styles.checklistSeccion}>
          <h4 className={styles.checklistTitulo}>Criterios de verificación</h4>
          <ul className={styles.checkList}>
            {indicador.detalles?.map((item, idx) => (
              <li
                key={idx}
                className={`${styles.checkItem} ${
                  item.cumple ? styles.checkItemCumple : styles.checkItemPendiente
                }`}
              >
                {item.cumple ? (
                  <CheckCircle2
                    className={styles.iconCumple}
                    aria-hidden="true"
                    size={18}
                  />
                ) : (
                  <AlertTriangle
                    className={styles.iconPendiente}
                    aria-hidden="true"
                    size={18}
                  />
                )}
                <span>{item.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
