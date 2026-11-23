// HU-08: barra del modo edición del mapa.
// HU-07: también permite trazar rutas de evacuación tocando el mapa.
import { Check, Plus, Route, Undo2, X } from 'lucide-react';

import Button from '../../components/Button.jsx';
import styles from './MapaEditorBar.module.css';

export default function MapaEditorBar({
  trazo,
  onAgregarPunto,
  onTrazarRuta,
  onDeshacer,
  onCancelarTrazo,
  onGuardarTrazo,
  onFinalizarEdicion,
}) {
  if (trazo) {
    const n = trazo.length;
    return (
      <div className={styles.bar} role="toolbar" aria-label="Trazar ruta de evacuación">
        <div className={styles.info} aria-live="polite">
          <strong>Trazando ruta · {n === 1 ? '1 punto' : `${n} puntos`}</strong>
          <span>
            {n === 0
              ? 'Toca el mapa donde empieza la ruta y sigue el recorrido hasta el punto seguro.'
              : n === 1
                ? 'Sigue tocando el mapa a lo largo del recorrido.'
                : 'Sigue tocando para alargarla, o guárdala cuando llegue al punto seguro.'}
          </span>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" icon={Undo2} onClick={onDeshacer} disabled={n === 0} className={styles.claro}>
            Deshacer
          </Button>
          <Button variant="secondary" size="sm" icon={X} onClick={onCancelarTrazo}>
            Cancelar
          </Button>
          <Button size="sm" icon={Check} onClick={onGuardarTrazo} disabled={n < 2}>
            Guardar ruta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bar} role="toolbar" aria-label="Herramientas de edición del mapa">
      <div className={styles.info}>
        <strong>Modo edición</strong>
        <span>Arrastra los puntos para reubicarlos, agrega puntos nuevos o traza una ruta.</span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAgregarPunto}>
          Agregar punto
        </Button>
        <Button variant="secondary" size="sm" icon={Route} onClick={onTrazarRuta}>
          Trazar ruta
        </Button>
        <Button size="sm" icon={Check} onClick={onFinalizarEdicion}>
          Listo
        </Button>
      </div>
    </div>
  );
}
