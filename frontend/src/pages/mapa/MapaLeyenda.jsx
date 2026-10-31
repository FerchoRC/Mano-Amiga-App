import { X } from 'lucide-react';

import styles from './Mapa.module.css';

export default function MapaLeyenda({ tipos, conteos = {}, visibles = new Set(), onToggle }) {
  const hayFiltros = tipos.some((tipo) => visibles.has(tipo.id));

  return (
    <section className={styles.card} aria-labelledby="leyenda-titulo">
      <div className={styles.cardHeader}>
        <h2 id="leyenda-titulo">Leyenda</h2>
      </div>
      <ul className={styles.legendList}>
        {tipos.map((tipo) => {
          const Icon = tipo.icono;
          const visible = visibles.has(tipo.id);
          const count = conteos[tipo.id] ?? 0;
          return (
            <li key={tipo.id}>
              <button
                type="button"
                className={styles.legendButton}
                aria-pressed={visible}
                onClick={() => onToggle?.(tipo.id)}
              >
                <span className={`${styles.legendDot} ${styles[tipo.tono]}`}>
                  <Icon size={12} aria-hidden="true" />
                </span>
                <span className={styles.legendText}>
                  <span>{tipo.plural ?? tipo.etiqueta}</span>
                  <span className={styles.legendMeta}>({count})</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hayFiltros && (
        <button type="button" className={styles.legendButton} onClick={() => onToggle?.('all')}>
          <span className={styles.legendText}>
            <span>Mostrar todo</span>
            <X size={14} aria-hidden="true" />
          </span>
        </button>
      )}
    </section>
  );
}
