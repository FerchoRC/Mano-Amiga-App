// HU-07: Detalle del punto o ruta seleccionada.
// HU-08: Permitir eliminar puntos a los administradores.
import { Trash2, X } from 'lucide-react';

import Button from '../../components/Button.jsx';
import { tipoElemento } from '../../lib/mapa.js';
import styles from './Mapa.module.css';

// `item.clase` distingue rutas de puntos; `item.tipo` es el tipo del punto.
export default function MapaDetalle({ item, onClose, puedeEditar = false, onEliminar }) {
  if (!item) return null;

  const esRuta = item.clase === 'ruta';
  const tipo = esRuta ? tipoElemento('ruta_evacuacion') : tipoElemento(item.tipo);
  const Icon = tipo?.icono ?? tipoElemento('punto_encuentro').icono;

  return (
    <section className={styles.card} aria-live="polite">
      <div className={styles.detailHead}>
        <span className={styles.detailType}>
          <span className={`${styles.detailIcon} ${styles[tipo?.tono ?? 'green']}`}>
            <Icon size={14} aria-hidden="true" />
          </span>
          {tipo?.etiqueta ?? 'Elemento'}
        </span>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar detalle">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.detail}>
        <h3>{item.nombre}</h3>
        <p className="muted">{item.descripcion || 'Sin descripción disponible.'}</p>
        {esRuta && item.origen && item.destino && (
          <p className="muted">
            Sigue las flechas: va de {item.origen} a {item.destino}.
          </p>
        )}

        {!esRuta && puedeEditar && (
          <div style={{ marginTop: '12px' }}>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => onEliminar?.(item)}
            >
              Eliminar punto
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
