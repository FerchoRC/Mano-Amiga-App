import { Link, Outlet } from 'react-router';

import imagenSede from '../assets/login-sede.webp';
import Logo from '../components/Logo.jsx';
import styles from './AuthLayout.module.css';

export default function AuthLayout() {
  return (
    <div className={styles.layout}>
      {/* La imagen va como fondo por CSS: así solo se descarga cuando el panel se muestra. */}
      <aside className={styles.brand} aria-label="ManoAmiga" style={{ '--imagen-sede': `url(${imagenSede})` }}>
        <Link to="/ingresar" className={styles.brandLogo}>
          <Logo inverse height={34} />
        </Link>

        <p className={styles.headline}>
          Tu empresa, lista para <span>cualquier emergencia.</span>
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
