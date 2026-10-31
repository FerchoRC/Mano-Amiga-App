import { X } from 'lucide-react';

import { tipoElemento } from '../../lib/mapa.js';
import styles from './Mapa.module.css';

export default function MapaDetalle({ item, onClose }) {
  if (!item) return null;

  const tipo = item.tipo === 'ruta' ? tipoElemento('ruta_evacuacion') : tipoElemento(item.tipo ?? item.tipoItem);
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
        {item.tipo === 'ruta' && item.origen && item.destino && (
          <p className="muted">Sigue la flecha: va de {item.origen} a {item.destino}</p>
        )}
      </div>
    </section>
  );
}
