import { MapPin } from 'lucide-react';

import { SelectField } from './Field.jsx';
import styles from './SedeSelect.module.css';

export default function SedeSelect({ sedes, value, onChange, label = 'Sede' }) {
  if (!sedes?.length) return null;

  if (sedes.length === 1) {
    const sede = sedes[0];
    return (
      <div className={styles.single}>
        <span className="eyebrow">{label}</span>
        <strong>{sede.nombre}</strong>
        <span className="muted">{sede.direccion} · {sede.ciudad}</span>
      </div>
    );
  }

  return (
    <div className={styles.selectWrap}>
      <SelectField label={label} value={value ?? sedes[0].id} onChange={(e) => onChange?.(e.target.value)}>
        {sedes.map((sede) => (
          <option key={sede.id} value={sede.id}>
            {sede.nombre} · {sede.ciudad}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
