import { CalendarCheck, MapPinned, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { TextArea, TextField } from '../../components/Field.jsx';
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
  const puedeRegistrarSimulacro = can(PERMISOS.SIMULACROS_GESTIONAR);
  const hoy = new Date().toLocaleDateString('sv-SE');

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogSimulacro, setDialogSimulacro] = useState(false);
  const [simulacros, setSimulacros] = useState([]);
  const [guardandoSimulacro, setGuardandoSimulacro] = useState(false);
  const [erroresSimulacro, setErroresSimulacro] = useState({});
  const [formSimulacro, setFormSimulacro] = useState(() => ({
    fecha: new Date().toLocaleDateString('sv-SE'),
    participantes: '',
    tiempoEvacuacion: '',
    observaciones: '',
    planMejora: '',
  }));

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

  useEffect(() => {
    if (!sede) return;
    const controller = new AbortController();
    api(`/api/sedes/${sede.id}/simulacros`, { signal: controller.signal })
      .then(({ simulacros = [] }) => setSimulacros(simulacros))
      .catch((err) => err.name !== 'AbortError' && setSimulacros([]));
    return () => controller.abort();
  }, [sede?.id]);

  useEffect(() => {
    if (searchParams.get('registrarSimulacro') === '1' && sede && puedeRegistrarSimulacro) {
      setDialogSimulacro(true);
    }
  }, [searchParams, sede?.id, puedeRegistrarSimulacro]);

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setDialogAgregar(true);
    }
  }, [searchParams]);

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

  async function guardarSimulacro(e) {
    e.preventDefault();
    if (!sede) return;
    const errores = {};
    if (!formSimulacro.fecha) errores.fecha = 'Indica la fecha del simulacro.';
    else if (formSimulacro.fecha > hoy) errores.fecha = 'Registra solo simulacros que ya se hicieron.';
    if (!(Number(formSimulacro.participantes) >= 1)) errores.participantes = 'Indica cuántas personas participaron.';
    setErroresSimulacro(errores);
    if (Object.keys(errores).length) return;

    setGuardandoSimulacro(true);
    try {
      const res = await api(`/api/sedes/${sede.id}/simulacros`, {
        method: 'POST',
        body: {
          fecha: formSimulacro.fecha,
          participantes: Number(formSimulacro.participantes),
          tiempoEvacuacion: formSimulacro.tiempoEvacuacion,
          observaciones: formSimulacro.observaciones,
          planMejora: formSimulacro.planMejora,
        },
      });
      setSimulacros((actual) => [res.simulacro, ...actual]);
      setDialogSimulacro(false);
      setSearchParams((actual) => {
        actual.delete('registrarSimulacro');
        return actual;
      });
      setFormSimulacro((actual) => ({ ...actual, participantes: '', tiempoEvacuacion: '', observaciones: '', planMejora: '' }));
      toast('Simulacro registrado como evidencia.');
    } catch (err) {
      setErroresSimulacro(err.campos ?? {});
      if (!Object.keys(err.campos ?? {}).length) toast(err.message, { tone: 'error' });
    } finally {
      setGuardandoSimulacro(false);
    }
  }

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
        {(puedeEditar || puedeRegistrarSimulacro) && sede && (
          <div className={styles.headerActions}>
            {puedeRegistrarSimulacro && (
              <Button variant="secondary" icon={CalendarCheck} onClick={() => setDialogSimulacro(true)}>
                Registrar simulacro
              </Button>
            )}
            {puedeEditar && (
              <Button
                variant={editando ? 'primary' : 'secondary'}
                icon={Pencil}
                onClick={() => setEditando((v) => !v)}
              >
                {editando ? 'Terminar edición' : 'Editar mapa'}
              </Button>
            )}
          </div>
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

      {simulacros.length > 0 && (
        <section className={styles.card} aria-label="Registro de simulacros">
          <div className={styles.cardHeader}>
            <h2>Simulacros registrados</h2>
          </div>
          <ul className={styles.list}>
            {simulacros.slice(0, 5).map((simulacro) => (
              <li key={simulacro.id} className={styles.listButton}>
                <span className={styles.itemText}>
                  <strong>
                    {new Date(`${simulacro.fecha}T12:00:00`).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                  <span>{simulacro.participantes} participantes{simulacro.tiempoEvacuacion ? ` · ${simulacro.tiempoEvacuacion}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={dialogSimulacro}
        onClose={() => {
          setDialogSimulacro(false);
          setErroresSimulacro({});
        }}
        title="Registrar simulacro de evacuación"
        description={`Constancia para ${sede?.nombre || 'la sede seleccionada'}.`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogSimulacro(false)} disabled={guardandoSimulacro}>Cerrar</Button>
            <Button type="button" variant="primary" loading={guardandoSimulacro} onClick={guardarSimulacro}>Guardar evidencia</Button>
          </>
        }
      >
        <form className={styles.simulacroForm} onSubmit={guardarSimulacro}>
          <TextField
            label="Fecha del simulacro"
            type="date"
            max={hoy}
            error={erroresSimulacro.fecha}
            value={formSimulacro.fecha}
            onChange={(e) => setFormSimulacro((actual) => ({ ...actual, fecha: e.target.value }))}
          />
          <TextField
            label="Participantes"
            type="number"
            min="1"
            inputMode="numeric"
            error={erroresSimulacro.participantes}
            value={formSimulacro.participantes}
            onChange={(e) => setFormSimulacro((actual) => ({ ...actual, participantes: e.target.value }))}
          />
          <TextField
            label="Tiempo de evacuación"
            placeholder="Ej. 4 min 30 s"
            maxLength={20}
            error={erroresSimulacro.tiempoEvacuacion}
            value={formSimulacro.tiempoEvacuacion}
            onChange={(e) => setFormSimulacro((actual) => ({ ...actual, tiempoEvacuacion: e.target.value }))}
          />
          <TextArea
            label="Observaciones"
            rows={3}
            value={formSimulacro.observaciones}
            onChange={(e) => setFormSimulacro((actual) => ({ ...actual, observaciones: e.target.value }))}
          />
          <TextArea
            label="Plan de mejora"
            rows={3}
            value={formSimulacro.planMejora}
            onChange={(e) => setFormSimulacro((actual) => ({ ...actual, planMejora: e.target.value }))}
          />
        </form>
      </Dialog>
    </div>
  );
}
