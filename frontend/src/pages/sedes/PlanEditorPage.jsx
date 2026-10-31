import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleDashed,
  CloudUpload,
  Ellipsis,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import Menu from '../../components/Menu.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import styles from './Plan.module.css';
import { revisarPlan, SECCIONES } from './planContent.js';
import { ProcedimientosEditor, PuntosEditor, RiesgosEditor } from './PlanSections.jsx';
import sedeStyles from './Sedes.module.css';

const ESPERA_AUTOGUARDADO_MS = 1200;

function EstadoGuardado({ estado }) {
  if (estado === 'guardando') {
    return (
      <span className={styles.saveState}>
        <span className="spinner" aria-hidden="true" />
        Guardando…
      </span>
    );
  }
  if (estado === 'pendiente') {
    return (
      <span className={styles.saveState}>
        <CloudUpload size={15} aria-hidden="true" />
        Cambios sin guardar
      </span>
    );
  }
  if (estado === 'error') {
    return (
      <span className={`${styles.saveState} ${styles.saveError}`}>
        <CircleAlert size={15} aria-hidden="true" />
        No se pudo guardar
      </span>
    );
  }
  return (
    <span className={`${styles.saveState} ${styles.saveOk}`}>
      <Check size={15} aria-hidden="true" />
      Guardado
    </span>
  );
}

// HU-05: editor del plan de emergencias por secciones. El borrador se guarda
// solo mientras se escribe; aprobarlo deja registrado quién y cuándo.
export default function PlanEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [sede, setSede] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [hayVigente, setHayVigente] = useState(false);
  const [contenido, setContenido] = useState(null);
  const [seccion, setSeccion] = useState(SECCIONES[0].id);
  const [error, setError] = useState(null);

  // Autoguardado: cada edición sube `cambios`; se guarda cuando la persona deja de escribir.
  const [cambios, setCambios] = useState(0);
  const guardados = useRef(0);
  const contenidoRef = useRef(null);
  const [estadoGuardado, setEstadoGuardado] = useState('guardado');
  const [errorGuardado, setErrorGuardado] = useState(null);

  const [confirmarAprobar, setConfirmarAprobar] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [errorAprobar, setErrorAprobar] = useState(null);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api(`/api/sedes/${id}`, { signal: controller.signal }),
      api(`/api/sedes/${id}/plan`, { signal: controller.signal }),
    ])
      .then(([{ sede }, plan]) => {
        if (!plan.borrador) {
          navigate(`/sedes/${id}`, { replace: true });
          return;
        }
        setSede(sede);
        setBorrador(plan.borrador);
        setHayVigente(Boolean(plan.vigente));
        setContenido(plan.borrador.contenido);
        contenidoRef.current = plan.borrador.contenido;
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [id, navigate]);

  const guardar = useCallback(async () => {
    const enviado = cambios;
    if (enviado === guardados.current) return true;
    setEstadoGuardado('guardando');
    try {
      const res = await api(`/api/sedes/${id}/plan/borrador`, {
        method: 'PUT',
        body: { contenido: contenidoRef.current },
      });
      guardados.current = enviado;
      setBorrador(res.borrador);
      setErrorGuardado(null);
      setEstadoGuardado((estado) => (estado === 'guardando' ? 'guardado' : estado));
      return true;
    } catch (err) {
      setEstadoGuardado('error');
      setErrorGuardado(err.message);
      return false;
    }
  }, [cambios, id]);

  useEffect(() => {
    if (cambios === guardados.current) return;
    setEstadoGuardado('pendiente');
    const timer = setTimeout(guardar, ESPERA_AUTOGUARDADO_MS);
    return () => clearTimeout(timer);
  }, [cambios, guardar]);

  // Avisar antes de cerrar la pestaña si quedan cambios sin guardar.
  useEffect(() => {
    if (estadoGuardado === 'guardado') return;
    const onBeforeUnload = (event) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [estadoGuardado]);

  const actualizar = (clave) => (lista) => {
    setContenido((c) => {
      const nuevo = { ...c, [clave]: lista };
      contenidoRef.current = nuevo;
      return nuevo;
    });
    setCambios((n) => n + 1);
  };

  async function aprobar() {
    setAprobando(true);
    setErrorAprobar(null);
    if (!(await guardar())) {
      setAprobando(false);
      setErrorAprobar('No pudimos guardar los últimos cambios. Intenta de nuevo.');
      return;
    }
    try {
      await api(`/api/sedes/${id}/plan/borrador/aprobar`, { method: 'POST' });
      toast(`La versión ${borrador.numero} del plan quedó aprobada.`);
      navigate(`/sedes/${id}`, { replace: true });
    } catch (err) {
      setErrorAprobar(Object.values(err.campos)[0] ?? err.message);
      setAprobando(false);
    }
  }

  async function descartar() {
    try {
      await api(`/api/sedes/${id}/plan/borrador`, { method: 'DELETE' });
      guardados.current = cambios;
      setEstadoGuardado('guardado');
      toast(hayVigente ? 'Descartaste el borrador. Sigue vigente la versión aprobada.' : 'Descartaste el plan.');
      navigate(`/sedes/${id}`, { replace: true });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!contenido) {
    return (
      <div className={sedeStyles.loading} aria-busy="true">
        <span className="spinner" />
      </div>
    );
  }

  const faltantes = revisarPlan(contenido);
  const completo = Object.keys(faltantes).length === 0;
  const indice = SECCIONES.findIndex((s) => s.id === seccion);
  const actual = SECCIONES[indice];
  const siguiente = SECCIONES[indice + 1];

  const conteo = {
    riesgos: contenido.riesgos.length,
    procedimientos: contenido.procedimientos.length,
    puntosEncuentro: contenido.puntosEncuentro.length,
  };

  return (
    <div className={sedeStyles.page}>
      <header className={sedeStyles.header}>
        <div className={sedeStyles.headerText}>
          <Link to={`/sedes/${id}`} className={sedeStyles.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            {sede.nombre}
          </Link>
          <h1>Plan de emergencias</h1>
          <p className={styles.editorMeta}>
            <span className={styles.draftTag}>Borrador · versión {borrador.numero}</span>
            <EstadoGuardado estado={estadoGuardado} />
          </p>
        </div>
        <div className={sedeStyles.headerActions}>
          <Menu
            label="Más acciones del borrador"
            trigger={<Ellipsis size={18} aria-hidden="true" />}
            items={[
              {
                label: 'Descartar borrador',
                icon: Trash2,
                tone: 'danger',
                onSelect: () => setConfirmarDescartar(true),
              },
            ]}
          />
          <Button icon={ShieldCheck} onClick={() => setConfirmarAprobar(true)} disabled={!completo}>
            Aprobar plan
          </Button>
        </div>
      </header>

      {errorGuardado && (
        <Alert
          tone="error"
          title="No pudimos guardar tus últimos cambios"
          action={
            <Button size="sm" variant="secondary" onClick={guardar}>
              Reintentar
            </Button>
          }
        >
          {errorGuardado}
        </Alert>
      )}

      <div className={styles.editorLayout}>
        <nav className={styles.sectionNav} aria-label="Secciones del plan">
          {SECCIONES.map((s) => {
            const Icono = s.icono;
            const lista = !faltantes[s.id];
            return (
              <button
                key={s.id}
                type="button"
                className={styles.sectionLink}
                aria-current={seccion === s.id ? 'step' : undefined}
                onClick={() => setSeccion(s.id)}
              >
                <Icono size={18} aria-hidden="true" className={styles.sectionIcon} />
                <span className={styles.sectionName}>
                  <span className={styles.sectionLong}>{s.titulo}</span>
                  <span className={styles.sectionShort}>{s.corto}</span>
                </span>
                <span className={`${styles.sectionState} ${lista ? styles.sectionDone : ''}`}>
                  {lista ? <Check size={14} aria-label="Completa" /> : <CircleDashed size={14} aria-label="Pendiente" />}
                  {conteo[s.id]}
                </span>
              </button>
            );
          })}
          <p className={styles.navNote}>
            {completo
              ? 'El plan está completo. Revísalo con tu profesional SST y apruébalo.'
              : 'Completa las tres secciones para poder aprobar el plan.'}
          </p>
        </nav>

        <section className={sedeStyles.card} aria-labelledby="seccion-titulo">
          <header className={styles.sectionHeader}>
            <h2 id="seccion-titulo">{actual.titulo}</h2>
            <p className="muted">{actual.descripcion}</p>
            {faltantes[actual.id] && (
              <p className={styles.sectionMissing}>
                <CircleDashed size={15} aria-hidden="true" />
                {faltantes[actual.id]}
              </p>
            )}
          </header>

          {seccion === 'riesgos' && (
            <RiesgosEditor riesgos={contenido.riesgos} onChange={actualizar('riesgos')} />
          )}
          {seccion === 'procedimientos' && (
            <ProcedimientosEditor
              procedimientos={contenido.procedimientos}
              onChange={actualizar('procedimientos')}
            />
          )}
          {seccion === 'puntosEncuentro' && (
            <PuntosEditor puntos={contenido.puntosEncuentro} onChange={actualizar('puntosEncuentro')} />
          )}

          <footer className={styles.sectionFooter}>
            {siguiente ? (
              <Button variant="secondary" onClick={() => setSeccion(siguiente.id)}>
                Siguiente: {siguiente.titulo.toLowerCase()}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            ) : (
              <Button icon={ShieldCheck} onClick={() => setConfirmarAprobar(true)} disabled={!completo}>
                Aprobar plan
              </Button>
            )}
          </footer>
        </section>
      </div>

      <Dialog
        open={confirmarAprobar}
        onClose={() => !aprobando && setConfirmarAprobar(false)}
        size="sm"
        title={`¿Aprobar la versión ${borrador.numero} del plan?`}
        description="Quedará registrada como aprobada por ti, con la fecha de hoy, y ya no se podrá editar. Si después necesitas cambiarla, crearás una nueva versión."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmarAprobar(false)} disabled={aprobando}>
              Volver
            </Button>
            <Button icon={ShieldCheck} onClick={aprobar} loading={aprobando}>
              Aprobar plan
            </Button>
          </>
        }
      >
        {errorAprobar && <Alert tone="error">{errorAprobar}</Alert>}
        {hayVigente && !errorAprobar && (
          <p className="muted" style={{ fontSize: 14 }}>
            Esta versión reemplazará a la vigente. La anterior queda en el historial.
          </p>
        )}
      </Dialog>

      <Dialog
        open={confirmarDescartar}
        onClose={() => setConfirmarDescartar(false)}
        size="sm"
        title="¿Descartar este borrador?"
        description={
          hayVigente
            ? 'Se perderán los cambios de esta versión. El plan aprobado seguirá vigente.'
            : 'La sede quedará sin plan de emergencias. Esta acción no se puede deshacer.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmarDescartar(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={descartar}>
              Descartar
            </Button>
          </>
        }
      />
    </div>
  );
}
