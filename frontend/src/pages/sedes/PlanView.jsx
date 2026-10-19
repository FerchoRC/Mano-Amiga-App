import { Users } from 'lucide-react';

import { formatearNumero } from '../../lib/format.js';
import styles from './Plan.module.css';
import { NIVELES, SECCIONES } from './planContent.js';

const etiquetaNivel = (id) => NIVELES.find((n) => n.id === id)?.etiqueta ?? id;

// Lectura de una versión del plan de emergencias, organizada por secciones.
export default function PlanView({ contenido }) {
  const [riesgos, procedimientos, puntos] = SECCIONES;

  return (
    <div className={styles.view}>
      <section className={styles.viewSection} aria-labelledby="ver-riesgos">
        <h3 id="ver-riesgos" className={styles.viewTitle}>
          <riesgos.icono size={18} aria-hidden="true" />
          {riesgos.titulo}
        </h3>
        <ul className={styles.riskList}>
          {contenido.riesgos.map((r) => (
            <li key={r.id}>
              <div className={styles.riskHead}>
                <span className={styles.riskType}>{r.tipo}</span>
                <span className={`${styles.level} ${styles[`level_${r.nivel}`]}`}>
                  Nivel {etiquetaNivel(r.nivel).toLowerCase()}
                </span>
              </div>
              {r.descripcion && <p className={styles.viewText}>{r.descripcion}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.viewSection} aria-labelledby="ver-procedimientos">
        <h3 id="ver-procedimientos" className={styles.viewTitle}>
          <procedimientos.icono size={18} aria-hidden="true" />
          {procedimientos.titulo}
        </h3>
        <div className={styles.procGrid}>
          {contenido.procedimientos.map((p) => (
            <article key={p.id} className={styles.procedure}>
              <h4 className={styles.procedureTitle}>{p.titulo}</h4>
              <ol className={styles.steps}>
                {p.pasos.filter((paso) => paso.trim()).map((paso, i) => (
                  <li key={i}>{paso}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.viewSection} aria-labelledby="ver-puntos">
        <h3 id="ver-puntos" className={styles.viewTitle}>
          <puntos.icono size={18} aria-hidden="true" />
          {puntos.titulo}
        </h3>
        <ul className={styles.pointList}>
          {contenido.puntosEncuentro.map((p) => (
            <li key={p.id}>
              <p className={styles.pointName}>{p.nombre}</p>
              {p.referencia && <p className={styles.viewText}>{p.referencia}</p>}
              {p.capacidad && (
                <p className={styles.pointCap}>
                  <Users size={14} aria-hidden="true" />
                  Capacidad para {formatearNumero(p.capacidad)} personas
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
