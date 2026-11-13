// HU-08: Barra de herramientas flotante del modo edición del mapa.
import { Check, Plus } from 'lucide-react';

import Button from '../../components/Button.jsx';
import styles from './MapaEditorBar.module.css';

export default function MapaEditorBar({ onAgregarPunto, onFinalizarEdicion }) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Herramientas de edición del mapa">
      <div className={styles.info}>
        <strong>Modo edición</strong>
        <span>Arrastra puntos para reubicarlos o agrega nuevos.</span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAgregarPunto}>
          Agregar punto
        </Button>
        <Button size="sm" icon={Check} onClick={onFinalizarEdicion}>
          Listo
        </Button>
      </div>
    </div>
  );
}
