import { BellRing, Building2, FileCheck2 } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import Logo from '../components/Logo.jsx';
import styles from './AuthLayout.module.css';

const PUNTOS = [
  { icon: Building2, texto: 'Cada sede con su plan, brigadas, mapa e inventario.' },
  { icon: BellRing, texto: 'Alertas a toda la sede y confirmación de quién está a salvo.' },
  { icon: FileCheck2, texto: 'Evidencias listas para la ARL y el Ministerio del Trabajo.' },
];

export default function AuthLayout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.brand} aria-label="ManoAmiga">
        <Link to="/ingresar" className={styles.brandLogo}>
          <Logo inverse height={34} />
        </Link>

        <div className={styles.pitch}>
          <p className={styles.eyebrow}>Gestión integral de emergencias</p>
          <p className={styles.headline}>
            Tu empresa lista para cualquier emergencia y para cualquier auditoría.
          </p>
          <ul className={styles.points}>
            {PUNTOS.map(({ icon: Icon, texto }) => (
              <li key={texto}>
                <span className={styles.pointIcon}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.legal}>
          Datos protegidos conforme a la Ley 1581 de 2012 · Hecho en Medellín
        </p>

        {/* Techo de la marca, como en la portada del documento. */}
        <svg className={styles.roof} viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,110 300,30 600,110 600,124 300,44 0,124" fill="#D7263D" />
          <polygon points="0,140 300,60 600,140" fill="rgb(255 255 255 / 0.06)" />
        </svg>
      </aside>

      <main className={styles.main}>
        <div className={styles.mobileLogo}>
          <Link to="/ingresar">
            <Logo height={32} />
          </Link>
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
