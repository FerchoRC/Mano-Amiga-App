import { iniciales } from '../lib/format.js';
import styles from './Avatar.module.css';

// Color estable por persona, dentro de una gama sobria de azules y grises.
const TONOS = ['#16325C', '#2F6FDE', '#3B5B8C', '#4C6A92', '#25507F', '#5A6B85'];

function tono(texto) {
  let hash = 0;
  for (const c of texto) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS[hash % TONOS.length];
}

export default function Avatar({ nombre, size = 36, muted = false }) {
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: muted ? '#E3E7EC' : tono(nombre),
        color: muted ? '#5B6474' : '#fff',
      }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  );
}
