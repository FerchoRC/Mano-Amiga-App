import { Building2, ChevronRight, MapPinPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import SedesMap from '../../components/map/SedesMap.jsx';
import { api } from '../../lib/api.js';
import { PERMISOS } from '../../lib/roles.js';
import PlanBadge from './PlanBadge.jsx';
import styles from './Sedes.module.css';

// HU-04: las sedes de la empresa, en lista y en el mapa.
export default function SedesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const gestiona = can(PERMISOS.SEDES_GESTIONAR);

  const [sedes, setSedes] = useState(null);
  const [error, setError] = useState(null);
  const [activa, setActiva] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/sedes', { signal: controller.signal })
      .then(({ sedes }) => setSedes(sedes))
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, []);

  const conPlan = sedes?.filter((s) => s.plan.estado === 'aprobado').length ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Sedes</h1>
          <p className="muted">
            {sedes?.length
              ? `${sedes.length} ${sedes.length === 1 ? 'sede' : 'sedes'} · ${conPlan} con plan de emergencias aprobado`
              : 'Cada lugar donde trabaja tu equipo tiene su propio plan, brigadas y mapa.'}
          </p>
        </div>
        {gestiona && sedes?.length > 0 && (
          <Button icon={MapPinPlus} to="/sedes/nueva">
            Registrar sede
          </Button>
        )}
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {sedes === null && !error && (
        <div className={styles.loading} aria-busy="true">
          <span className="spinner" />
          <span className="visually-hidden">Cargando sedes</span>
        </div>
      )}

      {sedes?.length === 0 && (
        <section className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Building2 size={26} aria-hidden="true" />
          </span>
          <h2>Aún no hay sedes registradas</h2>
          <p className="muted">
            {gestiona
              ? 'Registra cada lugar donde trabaja tu equipo: planta, bodega u oficina. Así podrás crear su plan de emergencias.'
              : 'Cuando el administrador registre las sedes de la empresa, las verás aquí.'}
          </p>
          {gestiona && (
            <Button icon={MapPinPlus} to="/sedes/nueva">
              Registrar la primera sede
            </Button>
          )}
        </section>
      )}

      {sedes?.length > 0 && (
        <div className={styles.split}>
          <ul className={styles.list}>
            {sedes.map((sede) => (
              <li key={sede.id}>
                <Link
                  to={`/sedes/${sede.id}`}
                  className={`${styles.item} ${activa === sede.id ? styles.itemActive : ''}`}
                  onMouseEnter={() => setActiva(sede.id)}
                  onMouseLeave={() => setActiva(null)}
                  onFocus={() => setActiva(sede.id)}
                  onBlur={() => setActiva(null)}
                >
                  <div className={styles.itemBody}>
                    <p className={styles.itemName}>{sede.nombre}</p>
                    <p className={styles.itemAddress}>
                      {sede.direccion} · {sede.ciudad}
                    </p>
                    <PlanBadge plan={sede.plan} />
                  </div>
                  <ChevronRight size={18} className={styles.itemArrow} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.mapCard}>
            <SedesMap sedes={sedes} activa={activa} onSelect={(sede) => navigate(`/sedes/${sede.id}`)} />
          </div>
        </div>
      )}
    </div>
  );
}
