import { MapPinned } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import SedeSelect from '../../components/SedeSelect.jsx';
import EvacuationMap from '../../components/map/EvacuationMap.jsx';
import { api } from '../../lib/api.js';
import { TIPOS_ELEMENTO } from '../../lib/mapa.js';
import useSedeSeleccionada from '../../lib/useSedeSeleccionada.js';
import MapaDetalle from './MapaDetalle.jsx';
import MapaLeyenda from './MapaLeyenda.jsx';
import MapaLista from './MapaLista.jsx';
import styles from './Mapa.module.css';

export default function MapaPage() {
  const { sedes, sede, setSedeId, error: errorSedes } = useSedeSeleccionada();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [visibles, setVisibles] = useState(() => new Set(TIPOS_ELEMENTO.map((tipo) => tipo.id)));

  useEffect(() => {
    if (!sede) return;
    const controller = new AbortController();
    setDatos(null);
    setError(null);
    setSeleccionado(null);
    api(`/api/sedes/${sede.id}/mapa`, { signal: controller.signal })
      .then(({ puntos = [], rutas = [] }) => {
        setDatos({ puntos, rutas });
        setVisibles(new Set(TIPOS_ELEMENTO.filter((tipo) => tipo.id === 'ruta_evacuacion' || puntos.some((punto) => punto.tipo === tipo.id)).map((tipo) => tipo.id)));
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [sede?.id]);

  const tiposPresentes = useMemo(() => {
    const present = new Set();
    for (const punto of datos?.puntos ?? []) present.add(punto.tipo);
    if ((datos?.rutas ?? []).length > 0) present.add('ruta_evacuacion');
    return present;
  }, [datos]);

  const lista = datos?.puntos ?? [];

  const toggleTipo = (tipo) => {
    if (tipo === 'all') {
      const siguiente = new Set(TIPOS_ELEMENTO.filter((item) => item.id === 'ruta_evacuacion' || (datos?.puntos ?? []).some((punto) => punto.tipo === item.id)).map((item) => item.id));
      setVisibles(siguiente);
      return;
    }

    setVisibles((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(tipo)) siguiente.delete(tipo);
      else siguiente.add(tipo);
      return siguiente;
    });
  };

  const conteos = Object.fromEntries(
    TIPOS_ELEMENTO.map((tipo) => [
      tipo.id,
      tipo.id === 'ruta_evacuacion'
        ? (datos?.rutas ?? []).length
        : (datos?.puntos ?? []).filter((punto) => punto.tipo === tipo.id).length,
    ])
  );

  if (errorSedes) {
    return (
      <div className={styles.page}>
        <Alert tone="error">{errorSedes}</Alert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Mapa de la sede</h1>
          <p className="muted">Rutas de evacuación, puntos de encuentro y equipos de {sede?.nombre ?? 'la sede'}.</p>
        </div>
      </header>

      {sedes.length > 1 && <SedeSelect sedes={sedes} value={sede?.id} onChange={setSedeId} />}

      {error && <Alert tone="error" action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>}>{error}</Alert>}

      {!sede && !error && (
        <div className={styles.empty}>
          <MapPinned size={28} aria-hidden="true" />
          <p className="muted">No hay sedes disponibles para mostrar el mapa.</p>
        </div>
      )}

      {sede && (
        <div className={styles.layout}>
          <section className={styles.mapCard}>
            {datos === null && !error ? (
              <div className={styles.loading} aria-busy="true">
                <span className="spinner" />
                <span className="visually-hidden">Cargando mapa</span>
              </div>
            ) : (
              <EvacuationMap
                sede={sede}
                puntos={datos?.puntos ?? []}
                rutas={datos?.rutas ?? []}
                visibles={visibles}
                seleccionado={seleccionado}
                onSelect={setSeleccionado}
              />
            )}
          </section>

          <aside className={styles.side}>
            <MapaLeyenda
              tipos={TIPOS_ELEMENTO}
              conteos={conteos}
              visibles={visibles}
              onToggle={toggleTipo}
            />

            <MapaLista
              puntos={datos?.puntos ?? []}
              rutas={datos?.rutas ?? []}
              onSelect={setSeleccionado}
              tiposPresentes={tiposPresentes}
            />

            {seleccionado && <MapaDetalle item={seleccionado} onClose={() => setSeleccionado(null)} />}
          </aside>
        </div>
      )}
    </div>
  );
}
