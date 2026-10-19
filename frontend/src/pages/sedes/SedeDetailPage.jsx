import {
  ArrowLeft,
  Check,
  CircleDashed,
  Ellipsis,
  FilePlus2,
  History,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import SedesMap from '../../components/map/SedesMap.jsx';
import Menu from '../../components/Menu.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { fechaCorta, tiempoRelativo } from '../../lib/format.js';
import { PERMISOS } from '../../lib/roles.js';
import PlanBadge from './PlanBadge.jsx';
import styles from './Plan.module.css';
import { revisarPlan, SECCIONES } from './planContent.js';
import PlanView from './PlanView.jsx';
import sedeStyles from './Sedes.module.css';

const quien = (persona) => persona?.nombre ?? 'un usuario eliminado';

function SinPlan({ gestiona, creando, onCrear }) {
  if (!gestiona) {
    return (
      <div className={styles.emptyPlan}>
        <CircleDashed size={24} aria-hidden="true" />
        <p>El plan de emergencias de esta sede aún no está aprobado.</p>
      </div>
    );
  }
  return (
    <div className={styles.emptyPlan}>
      <h3>Esta sede aún no tiene plan de emergencias</h3>
      <p className="muted">
        Identifica sus riesgos, define qué hacer en cada emergencia y dónde se reúne el equipo.
      </p>
      <div className={styles.emptyActions}>
        <Button icon={Sparkles} onClick={() => onCrear(true)} loading={creando === 'plantilla'}>
          Empezar con plantilla sugerida
        </Button>
        <Button variant="secondary" onClick={() => onCrear(false)} loading={creando === 'blanco'}>
          Empezar en blanco
        </Button>
      </div>
      <p className={styles.note}>
        La plantilla incluye riesgos y procedimientos comunes en el Valle de Aburrá. Valídala con tu
        profesional SST antes de aprobarla.
      </p>
    </div>
  );
}

function BorradorResumen({ sedeId, borrador, esNuevaVersion }) {
  const faltantes = revisarPlan(borrador.contenido);
  return (
    <div className={styles.draftBox}>
      <div className={styles.draftHead}>
        <div>
          <p className={styles.draftTitle}>
            {esNuevaVersion ? `Versión ${borrador.numero} en borrador` : 'Plan en borrador'}
          </p>
          <p className={styles.meta}>
            Editado por {quien(borrador.actualizadoPor)} · {tiempoRelativo(borrador.actualizadoEn)}
          </p>
        </div>
        <Button icon={Pencil} to={`/sedes/${sedeId}/plan`}>
          Continuar editando
        </Button>
      </div>
      <ul className={styles.checklist}>
        {SECCIONES.map((s) => (
          <li key={s.id} className={faltantes[s.id] ? '' : styles.checkOk}>
            {faltantes[s.id] ? (
              <CircleDashed size={16} aria-hidden="true" />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
            <span>
              <strong>{s.titulo}</strong>
              {faltantes[s.id] && <span className={styles.missing}> · {faltantes[s.id]}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// HU-04 y HU-05: ficha de la sede con su ubicación y su plan de emergencias.
export default function SedeDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const gestionaSede = can(PERMISOS.SEDES_GESTIONAR);
  const gestionaPlan = can(PERMISOS.PLANES_GESTIONAR);

  const [sede, setSede] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(null);
  const [eliminar, setEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [versionAbierta, setVersionAbierta] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [{ sede }, plan] = await Promise.all([
        api(`/api/sedes/${id}`),
        api(`/api/sedes/${id}/plan`),
      ]);
      setSede(sede);
      setPlan(plan);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crearPlan(plantilla) {
    setCreando(plantilla ? 'plantilla' : 'blanco');
    try {
      await api(`/api/sedes/${id}/plan`, { method: 'POST', body: { plantilla } });
      navigate(`/sedes/${id}/plan`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
      setCreando(null);
    }
  }

  async function nuevaVersion() {
    try {
      await api(`/api/sedes/${id}/plan/versiones`, { method: 'POST' });
      navigate(`/sedes/${id}/plan`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function abrirVersion(numero) {
    try {
      const { version } = await api(`/api/sedes/${id}/plan/versiones/${numero}`);
      setVersionAbierta(version);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function confirmarEliminar() {
    setEliminando(true);
    try {
      await api(`/api/sedes/${id}`, { method: 'DELETE' });
      toast(`${sede.nombre} fue eliminada.`);
      navigate('/sedes', { replace: true });
    } catch (err) {
      toast(err.message, { tone: 'error' });
      setEliminando(false);
      setEliminar(false);
    }
  }

  if (error) {
    return (
      <div className={sedeStyles.page}>
        <Link to="/sedes" className={sedeStyles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Sedes
        </Link>
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  if (!sede || !plan) {
    return (
      <div className={sedeStyles.loading} aria-busy="true">
        <span className="spinner" />
      </div>
    );
  }

  const { vigente, borrador, versiones } = plan;

  return (
    <div className={sedeStyles.page}>
      <header className={sedeStyles.header}>
        <div className={sedeStyles.headerText}>
          <Link to="/sedes" className={sedeStyles.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            Sedes
          </Link>
          <h1>{sede.nombre}</h1>
          <p className="muted">
            {sede.direccion} · {sede.ciudad}
          </p>
        </div>
        {gestionaSede && (
          <div className={sedeStyles.headerActions}>
            <Button variant="secondary" icon={Pencil} to={`/sedes/${id}/editar`}>
              Editar sede
            </Button>
            <Menu
              label="Más acciones de la sede"
              trigger={<Ellipsis size={18} aria-hidden="true" />}
              items={[
                {
                  label: 'Eliminar sede',
                  icon: Trash2,
                  tone: 'danger',
                  onSelect: () => setEliminar(true),
                },
              ]}
            />
          </div>
        )}
      </header>

      <div className={sedeStyles.detailLayout}>
        <section className={sedeStyles.card} aria-labelledby="plan-titulo">
          <div className={styles.planHead}>
            <div className={styles.planHeadText}>
              <h2 id="plan-titulo">Plan de emergencias</h2>
              {vigente ? (
                <p className={styles.meta}>
                  Versión {vigente.numero} · aprobada por {quien(vigente.aprobadoPor)} el{' '}
                  {fechaCorta(vigente.aprobadoEn)}
                </p>
              ) : (
                plan.plan && (
                  <p className={styles.meta}>
                    Creado por {quien(plan.plan.creadoPor)} el {fechaCorta(plan.plan.creadoEn)}
                  </p>
                )
              )}
            </div>
            <PlanBadge plan={sede.plan} />
          </div>

          {!plan.plan && <SinPlan gestiona={gestionaPlan} creando={creando} onCrear={crearPlan} />}

          {borrador && (
            <BorradorResumen sedeId={id} borrador={borrador} esNuevaVersion={Boolean(vigente)} />
          )}

          {vigente && (
            <>
              {gestionaPlan && !borrador && (
                <div className={styles.versionBar}>
                  <p>
                    Un plan aprobado no se modifica: queda como evidencia. Para actualizarlo, crea una
                    nueva versión.
                  </p>
                  <Button variant="secondary" size="sm" icon={FilePlus2} onClick={nuevaVersion}>
                    Crear nueva versión
                  </Button>
                </div>
              )}
              <PlanView contenido={vigente.contenido} />
            </>
          )}
        </section>

        <aside className={sedeStyles.side}>
          <div className={sedeStyles.locationCard}>
            <div className={sedeStyles.miniMap}>
              <SedesMap sedes={[sede]} activa={sede.id} />
            </div>
            <div className={sedeStyles.locationBody}>
              <strong>{sede.direccion}</strong>
              <span className="muted">{sede.ciudad}</span>
              <span className={sedeStyles.coords}>
                {sede.lat.toFixed(5)}, {sede.lng.toFixed(5)}
              </span>
            </div>
          </div>

          {versiones.length > 0 && plan.plan && (
            <section className={sedeStyles.card} aria-labelledby="historial-titulo">
              <h2 id="historial-titulo" className={styles.sideTitle}>
                <History size={18} aria-hidden="true" />
                Historial del plan
              </h2>
              <ol className={styles.history}>
                {versiones.map((v) => {
                  const esVigente = vigente?.numero === v.numero;
                  const contenidoVersion = (
                    <>
                      <span className={styles.historyTop}>
                        <strong>Versión {v.numero}</strong>
                        <span
                          className={
                            v.estado === 'borrador'
                              ? styles.tagDraft
                              : esVigente
                                ? styles.tagCurrent
                                : styles.tagOld
                          }
                        >
                          {v.estado === 'borrador' ? 'Borrador' : esVigente ? 'Vigente' : 'Reemplazada'}
                        </span>
                      </span>
                      <span className={styles.meta}>
                        {v.estado === 'aprobado'
                          ? `Aprobada por ${quien(v.aprobadoPor)} · ${fechaCorta(v.aprobadoEn)}`
                          : `Creada por ${quien(v.creadoPor)} · ${fechaCorta(v.creadoEn)}`}
                      </span>
                    </>
                  );
                  return (
                    <li key={v.numero}>
                      {v.estado === 'aprobado' && !esVigente ? (
                        <button type="button" className={styles.historyItem} onClick={() => abrirVersion(v.numero)}>
                          {contenidoVersion}
                        </button>
                      ) : (
                        <div className={styles.historyItem}>{contenidoVersion}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {plan.plan && (
                <p className={styles.note}>
                  Plan creado por {quien(plan.plan.creadoPor)} el {fechaCorta(plan.plan.creadoEn)}.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      <Dialog
        open={eliminar}
        onClose={() => !eliminando && setEliminar(false)}
        size="sm"
        title={`¿Eliminar ${sede.nombre}?`}
        description={
          plan.plan
            ? 'También se eliminará su plan de emergencias con todas sus versiones. Esta acción no se puede deshacer.'
            : 'Esta acción no se puede deshacer.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEliminar(false)} disabled={eliminando}>
              Volver
            </Button>
            <Button variant="danger" onClick={confirmarEliminar} loading={eliminando}>
              Eliminar sede
            </Button>
          </>
        }
      />

      <Dialog
        open={Boolean(versionAbierta)}
        onClose={() => setVersionAbierta(null)}
        title={versionAbierta ? `Versión ${versionAbierta.numero} (reemplazada)` : ''}
        description={
          versionAbierta &&
          `Aprobada por ${quien(versionAbierta.aprobadoPor)} el ${fechaCorta(versionAbierta.aprobadoEn)}.`
        }
        footer={<Button onClick={() => setVersionAbierta(null)}>Cerrar</Button>}
      >
        {versionAbierta && <PlanView contenido={versionAbierta.contenido} />}
      </Dialog>
    </div>
  );
}
