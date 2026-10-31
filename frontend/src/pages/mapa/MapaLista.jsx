import { ChevronRight } from 'lucide-react';

import { tipoElemento } from '../../lib/mapa.js';
import styles from './Mapa.module.css';

export default function MapaLista({ puntos = [], rutas = [], onSelect, tiposPresentes = new Set() }) {
  const grupos = [
    { id: 'punto_encuentro', titulo: 'Puntos de encuentro', items: puntos.filter((punto) => punto.tipo === 'punto_encuentro') },
    { id: 'ruta_evacuacion', titulo: 'Rutas de evacuación', items: rutas },
    { id: 'extintor', titulo: 'Equipos', items: puntos.filter((punto) => punto.tipo !== 'punto_encuentro') },
  ].filter((grupo) => grupo.items.length > 0 || tiposPresentes.has(grupo.id));

  return (
    <section className={styles.card} aria-label="Lista del mapa">
      <div className={styles.cardHeader}>
        <h2>Lista</h2>
      </div>

      <ul className={styles.list}>
        {grupos.map((grupo) => (
          <li key={grupo.id}>
            <div className={styles.sectionTitle}>{grupo.titulo}</div>
            <ul className={styles.list}>
              {grupo.items.map((item) => {
                const tipo = grupo.id === 'ruta_evacuacion' ? tipoElemento('ruta_evacuacion') : tipoElemento(item.tipo);
                const Icon = tipo?.icono ?? tipoElemento('punto_encuentro').icono;
                return (
                  <li key={item.id ?? `${grupo.id}-${item.nombre}`}>
                    <button
                      type="button"
                      className={styles.listButton}
                      onClick={() => onSelect?.(item)}
                    >
                      <span className={`${styles.legendDot} ${styles[tipo?.tono ?? 'green']}`}>
                        <Icon size={12} aria-hidden="true" />
                      </span>
                      <span className={styles.listItem}>
                        <span className={styles.itemText}>
                          <strong>{item.nombre}</strong>
                          <span>{item.descripcion || 'Sin descripción'}</span>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
