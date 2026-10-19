import { Plus, Trash2, X } from 'lucide-react';
import { useRef } from 'react';

import Button from '../../components/Button.jsx';
import { SelectField, TextArea, TextField } from '../../components/Field.jsx';
import styles from './Plan.module.css';
import { NIVELES, nuevoProcedimiento, nuevoPunto, nuevoRiesgo, TIPOS_RIESGO } from './planContent.js';

// Editores de cada sección del plan. Reciben la lista y `onChange(listaNueva)`.

const reemplazar = (lista, id, cambios) => lista.map((x) => (x.id === id ? { ...x, ...cambios } : x));
const quitar = (lista, id) => lista.filter((x) => x.id !== id);

function ItemCard({ titulo, onQuitar, etiquetaQuitar, children }) {
  return (
    <article className={styles.itemCard}>
      <header className={styles.itemHead}>
        <span className={styles.itemNumber}>{titulo}</span>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={onQuitar}
          aria-label={etiquetaQuitar}
          title={etiquetaQuitar}
        />
      </header>
      {children}
    </article>
  );
}

function AgregarBoton({ onClick, children }) {
  return (
    <button type="button" className={styles.addButton} onClick={onClick}>
      <Plus size={16} aria-hidden="true" />
      {children}
    </button>
  );
}

export function RiesgosEditor({ riesgos, onChange }) {
  return (
    <div className={styles.items}>
      {riesgos.map((r, i) => (
        <ItemCard
          key={r.id}
          titulo={`Riesgo ${i + 1}`}
          onQuitar={() => onChange(quitar(riesgos, r.id))}
          etiquetaQuitar={`Quitar riesgo ${i + 1}`}
        >
          <div className={styles.riskRow}>
            <SelectField
              label="Tipo de riesgo"
              value={r.tipo}
              onChange={(e) => onChange(reemplazar(riesgos, r.id, { tipo: e.target.value }))}
            >
              {TIPOS_RIESGO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectField>
            <fieldset className={styles.levels}>
              <legend>Nivel</legend>
              <div className={styles.levelOptions}>
                {NIVELES.map((n) => (
                  <label key={n.id} className={`${styles.levelOption} ${styles[`levelOption_${n.id}`]}`}>
                    <input
                      type="radio"
                      name={`nivel-${r.id}`}
                      value={n.id}
                      checked={r.nivel === n.id}
                      onChange={() => onChange(reemplazar(riesgos, r.id, { nivel: n.id }))}
                    />
                    <span>{n.etiqueta}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <TextArea
            label="Descripción"
            placeholder="¿Por qué existe este riesgo en la sede y qué podría afectar?"
            value={r.descripcion}
            maxLength={500}
            onChange={(e) => onChange(reemplazar(riesgos, r.id, { descripcion: e.target.value }))}
          />
        </ItemCard>
      ))}
      <AgregarBoton onClick={() => onChange([...riesgos, nuevoRiesgo()])}>Agregar riesgo</AgregarBoton>
    </div>
  );
}

function Pasos({ pasos, onChange, etiqueta }) {
  const lista = useRef(null);
  const enfocar = (indice) =>
    requestAnimationFrame(() => lista.current?.querySelectorAll('input')[indice]?.focus());

  const cambiar = (i, valor) => onChange(pasos.map((p, j) => (j === i ? valor : p)));
  const insertarDespues = (i) => {
    onChange([...pasos.slice(0, i + 1), '', ...pasos.slice(i + 1)]);
    enfocar(i + 1);
  };
  const quitarPaso = (i) => {
    onChange(pasos.length > 1 ? pasos.filter((_, j) => j !== i) : ['']);
    enfocar(Math.max(0, i - 1));
  };

  return (
    <div className={styles.stepsEditor}>
      <p className={styles.stepsLabel} id={`${etiqueta}-pasos`}>
        Pasos <span className={styles.stepsHint}>· Enter agrega el siguiente</span>
      </p>
      <ol ref={lista} className={styles.stepInputs} aria-labelledby={`${etiqueta}-pasos`}>
        {pasos.map((paso, i) => (
          <li key={i}>
            <span className={styles.stepNumber} aria-hidden="true">
              {i + 1}
            </span>
            <input
              className={styles.stepInput}
              value={paso}
              maxLength={300}
              placeholder={i === 0 ? 'Primer paso' : 'Siguiente paso'}
              aria-label={`Paso ${i + 1}`}
              onChange={(e) => cambiar(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertarDespues(i);
                } else if (e.key === 'Backspace' && paso === '' && pasos.length > 1) {
                  e.preventDefault();
                  quitarPaso(i);
                }
              }}
            />
            <button
              type="button"
              className={styles.stepRemove}
              onClick={() => quitarPaso(i)}
              aria-label={`Quitar paso ${i + 1}`}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className={styles.linkButton} onClick={() => insertarDespues(pasos.length - 1)}>
        <Plus size={15} aria-hidden="true" />
        Agregar paso
      </button>
    </div>
  );
}

export function ProcedimientosEditor({ procedimientos, onChange }) {
  return (
    <div className={styles.items}>
      {procedimientos.map((p, i) => (
        <ItemCard
          key={p.id}
          titulo={`Procedimiento ${i + 1}`}
          onQuitar={() => onChange(quitar(procedimientos, p.id))}
          etiquetaQuitar={`Quitar procedimiento ${i + 1}`}
        >
          <TextField
            label="Título"
            placeholder="Evacuación por sismo, conato de incendio…"
            value={p.titulo}
            maxLength={120}
            onChange={(e) => onChange(reemplazar(procedimientos, p.id, { titulo: e.target.value }))}
          />
          <Pasos
            etiqueta={p.id}
            pasos={p.pasos}
            onChange={(pasos) => onChange(reemplazar(procedimientos, p.id, { pasos }))}
          />
        </ItemCard>
      ))}
      <AgregarBoton onClick={() => onChange([...procedimientos, nuevoProcedimiento()])}>
        Agregar procedimiento
      </AgregarBoton>
    </div>
  );
}

export function PuntosEditor({ puntos, onChange }) {
  return (
    <div className={styles.items}>
      {puntos.map((p, i) => (
        <ItemCard
          key={p.id}
          titulo={`Punto ${i + 1}`}
          onQuitar={() => onChange(quitar(puntos, p.id))}
          etiquetaQuitar={`Quitar punto de encuentro ${i + 1}`}
        >
          <div className={styles.pointRow}>
            <TextField
              label="Nombre"
              placeholder="Parqueadero norte"
              value={p.nombre}
              maxLength={120}
              onChange={(e) => onChange(reemplazar(puntos, p.id, { nombre: e.target.value }))}
            />
            <TextField
              label="Capacidad"
              optional
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Personas"
              value={p.capacidad ?? ''}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                onChange(reemplazar(puntos, p.id, { capacidad: Number.isFinite(n) && n > 0 ? n : null }));
              }}
            />
          </div>
          <TextArea
            label="Dónde queda y cómo llegar"
            placeholder="Frente a la portería principal, saliendo por la puerta de evacuación oriental."
            rows={2}
            value={p.referencia}
            maxLength={300}
            onChange={(e) => onChange(reemplazar(puntos, p.id, { referencia: e.target.value }))}
          />
        </ItemCard>
      ))}
      <AgregarBoton onClick={() => onChange([...puntos, nuevoPunto()])}>
        Agregar punto de encuentro
      </AgregarBoton>
    </div>
  );
}
