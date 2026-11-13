import { MapPinned, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import SedeSelect from '../../components/SedeSelect.jsx';
import { useToast } from '../../components/Toast.jsx';
import EvacuationMap from '../../components/map/EvacuationMap.jsx';
import { api } from '../../lib/api.js';
import { TIPOS_ELEMENTO } from '../../lib/mapa.js';
import { PERMISOS } from '../../lib/roles.js';
import useSedeSeleccionada from '../../lib/useSedeSeleccionada.js';
import { useRealtimeEvent } from '../../lib/useRealtime.js';
import AddPuntoDialog from './AddPuntoDialog.jsx';
import MapaDetalle from './MapaDetalle.jsx';
import MapaEditorBar from './MapaEditorBar.jsx';
import MapaLeyenda from './MapaLeyenda.jsx';
import MapaLista from './MapaLista.jsx';
import styles from './Mapa.module.css';

export default function MapaPage() {
  const { can } = useAuth();
  const toast = useToast();
  // HU-08: solo el administrador edita el mapa (el backend también lo exige).
  const puedeEditar = can(PERMISOS.MAPA_GESTIONAR);

  const { sedes, sede, setSedeId, error: errorSedes } = useSedeSeleccionada();
  const [datos, setDatos] = useState(null);
  const datosRef = useRef(null);
  datosRef.current = datos;
  const [error, setError] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [visibles, setVisibles] = useState(() => new Set(TIPOS_ELEMENTO.map((tipo) => tipo.id)));
  const [editando, setEditando] = useState(false);
  const [dialogAgregar, setDialogAgregar] = useState(false);
  const [coordenadasNuevo, setCoordenadasNuevo] = useState(null);
  const [puntoAEliminar, setPuntoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!sede) return;
    const controller = new AbortController();
    setDatos(null);
    setError(null);
    setSeleccionado(null);
    setEditando(false);
    api(`/api/sedes/${sede.id}/mapa`, { signal: controller.signal })
      .then(({ puntos = [], rutas = [] }) => {
        setDatos({ puntos, rutas });
        setVisibles(new Set(TIPOS_ELEMENTO.filter((tipo) => tipo.id === 'ruta_evacuacion' || puntos.some((punto) => punto.tipo === tipo.id)).map((tipo) => tipo.id)));
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [sede?.id]);

  // Recarga sin perder la selección ni el modo edición; los tipos nuevos se muestran.
  const sedeId = sede?.id;
  const recargar = useCallback(() => {
    if (!sedeId) return;
    api(`/api/sedes/${sedeId}/mapa`)
      .then(({ puntos = [], rutas = [] }) => {
        const antes = new Set((datosRef.current?.puntos ?? []).map((p) => p.tipo));
        const nuevos = puntos.map((p) => p.tipo).filter((t) => !antes.has(t));
        if (nuevos.length) setVisibles((v) => new Set([...v, ...nuevos]));
        setDatos({ puntos, rutas });
        setSeleccionado((actual) => {
          if (!actual || actual.clase === 'ruta') return actual;
          const punto = puntos.find((p) => p.id === actual.id);
          return punto ? { ...punto, clase: 'punto' } : null;
        });
      })
      .catch(() => {});
  }, [sedeId]);

  // HU-08: cuando el administrador cambia el mapa, todos lo ven al instante.
  const onMapaActualizado = useCallback(
    (data) => {
      if (data?.sedeId === sedeId) recargar();
    },
    [sedeId, recargar]
  );
  useRealtimeEvent('mapa:actualizado', onMapaActualizado);

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

  // HU-08: Mover punto
  async function handleMoverPunto(idPunto, lat, lng) {
    // Actualización optimista inmediata
    setDatos((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        puntos: prev.puntos.map((p) => (p.id === idPunto ? { ...p, lat, lng } : p)),
      };
    });

    try {
      await api(`/api/sedes/${sede.id}/mapa/puntos/${idPunto}`, {
        method: 'PUT',
        body: { lat, lng },
      });
      toast('Ubicación del punto actualizada.');
    } catch (err) {
      toast(err.message, { tone: 'error' });
      recargar(); // devuelve el punto a su posición guardada
    }
  }

  // HU-08: Eliminar punto
  async function confirmarEliminar() {
    if (!puntoAEliminar) return;
    setEliminando(true);
    try {
      await api(`/api/sedes/${sede.id}/mapa/puntos/${puntoAEliminar.id}`, {
        method: 'DELETE',
      });
      setDatos((prev) => ({
        ...prev,
        puntos: prev.puntos.filter((p) => p.id !== puntoAEliminar.id),
      }));
      if (seleccionado?.id === puntoAEliminar.id) {
        setSeleccionado(null);
      }
      toast(`${puntoAEliminar.nombre} fue eliminado del mapa.`);
      setPuntoAEliminar(null);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setEliminando(false);
    }
  }

  const handlePuntoAgregado = (nuevoPunto) => {
    setDatos((prev) => ({
      ...prev,
      puntos: [...(prev?.puntos ?? []), nuevoPunto],
    }));
    setVisibles((prev) => new Set(prev).add(nuevoPunto.tipo));
    setSeleccionado({ ...nuevoPunto, clase: 'punto' });
    toast(`${nuevoPunto.nombre} fue agregado al mapa.`);
  };

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
        {puedeEditar && sede && (
          <Button
            variant={editando ? 'primary' : 'secondary'}
            icon={Pencil}
            onClick={() => setEditando((v) => !v)}
          >
            {editando ? 'Terminar edición' : 'Editar mapa'}
          </Button>
        )}
      </header>

      {editando && (
        <MapaEditorBar
          onAgregarPunto={() => {
            setCoordenadasNuevo(null);
            setDialogAgregar(true);
          }}
          onFinalizarEdicion={() => setEditando(false)}
        />
      )}

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
                editando={editando}
                onMoverPunto={handleMoverPunto}
                onClicMapa={(coords) => {
                  setCoordenadasNuevo(coords);
                  setDialogAgregar(true);
                }}
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

            {seleccionado && (
              <MapaDetalle
                item={seleccionado}
                puedeEditar={puedeEditar}
                onEliminar={(p) => setPuntoAEliminar(p)}
                onClose={() => setSeleccionado(null)}
              />
            )}
          </aside>
        </div>
      )}

      {dialogAgregar && (
        <AddPuntoDialog
          open={dialogAgregar}
          sede={sede}
          coordenadas={coordenadasNuevo}
          onClose={() => {
            setDialogAgregar(false);
            setCoordenadasNuevo(null);
          }}
          onAdded={handlePuntoAgregado}
        />
      )}

      <Dialog
        open={Boolean(puntoAEliminar)}
        onClose={() => !eliminando && setPuntoAEliminar(null)}
        size="sm"
        title={`¿Eliminar ${puntoAEliminar?.nombre}?`}
        description="El elemento se eliminará del mapa de evacuación de esta sede."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPuntoAEliminar(null)} disabled={eliminando}>
              Volver
            </Button>
            <Button variant="danger" onClick={confirmarEliminar} loading={eliminando}>
              Eliminar punto
            </Button>
          </>
        }
      />
    </div>
  );
}
