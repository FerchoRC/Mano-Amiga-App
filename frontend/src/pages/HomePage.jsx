import { ArrowRight, BellRing, Check, Scale } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { fechaCorta, fechaLarga, formatearNumero, primerNombre, saludo } from '../lib/format.js';
import { PERMISOS, ROLES } from '../lib/roles.js';
import styles from './HomePage.module.css';

function obligacion(numEmpleados) {
  if (numEmpleados <= 10) {
    return 'Con 10 trabajadores o menos, la Resolución 0312 de 2019 exige capacitación básica en primeros auxilios, incendios y evacuación.';
  }
  return 'Con más de 10 trabajadores, la Resolución 0312 de 2019 exige un plan de prevención, preparación y respuesta ante emergencias y una brigada.';
}

function PrimerosPasos({ empresa }) {
  const [total, setTotal] = useState(null);
  const [sedes, setSedes] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/usuarios', { signal: controller.signal })
      .then(({ usuarios }) => setTotal(usuarios.length))
      .catch(() => {});
    api('/api/sedes', { signal: controller.signal })
      .then(({ sedes }) => setSedes(sedes))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const equipoListo = total !== null && total > 1;
  const numSedes = sedes?.length ?? 0;
  const conPlan = sedes?.filter((s) => s.plan.estado === 'aprobado').length ?? 0;
  const planesListos = numSedes > 0 && conPlan === numSedes;
  const pasos = [
    {
      titulo: 'Registrar la empresa',
      detalle: `Registrada el ${fechaCorta(empresa.creadoEn)}.`,
      hecho: true,
    },
    {
      titulo: 'Invitar a tu equipo',
      detalle: equipoListo
        ? `${total} personas en tu equipo.`
        : 'Invita a brigadistas y empleados, y define qué puede hacer cada uno.',
      hecho: equipoListo,
      accion: { texto: equipoListo ? 'Ver equipo' : 'Invitar personas', to: '/equipo' },
    },
    {
      titulo: 'Registrar las sedes',
      detalle:
        numSedes > 0
          ? `${numSedes} ${numSedes === 1 ? 'sede registrada' : 'sedes registradas'}.`
          : 'Dirección y ubicación en el mapa de cada sede.',
      hecho: numSedes > 0,
      accion: numSedes > 0 ? { texto: 'Ver sedes', to: '/sedes' } : { texto: 'Registrar sede', to: '/sedes/nueva' },
    },
    {
      titulo: 'Crear el plan de emergencias',
      detalle:
        numSedes > 0
          ? `${conPlan} de ${numSedes} ${numSedes === 1 ? 'sede' : 'sedes'} con plan aprobado.`
          : 'Riesgos, procedimientos y puntos de encuentro de cada sede.',
      hecho: planesListos,
      accion: numSedes > 0 && !planesListos ? { texto: 'Ir a las sedes', to: '/sedes' } : undefined,
    },
    {
      titulo: 'Conformar las brigadas',
      detalle: 'Primeros auxilios, evacuación y contra incendios, cada una con su líder.',
      proximamente: true,
    },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <section className={styles.card} aria-labelledby="pasos-titulo">
      <div className={styles.cardHead}>
        <div>
          <h2 id="pasos-titulo">Prepara tu empresa</h2>
          <p className="muted">Lo que necesitas para estar listo ante una emergencia o una auditoría.</p>
        </div>
        <p className={styles.progressText}>
          <strong>{hechos}</strong> de {pasos.length}
        </p>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Avance"
        aria-valuemin={0}
        aria-valuemax={pasos.length}
        aria-valuenow={hechos}
      >
        <span style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>

      <ol className={styles.steps}>
        {pasos.map((paso, i) => (
          <li
            key={paso.titulo}
            className={`${styles.step} ${paso.hecho ? styles.done : ''} ${paso.proximamente ? styles.soon : ''}`}
          >
            <span className={styles.marker} aria-hidden="true">
              {paso.hecho ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <div className={styles.stepBody}>
              <p className={styles.stepTitle}>
                {paso.titulo}
                {paso.hecho && <span className="visually-hidden"> (completado)</span>}
                {paso.proximamente && <span className={styles.soonTag}>Próximamente</span>}
              </p>
              <p className={styles.stepText}>{paso.detalle}</p>
            </div>
            {paso.accion && (
              <Link to={paso.accion.to} className={styles.stepAction}>
                {paso.accion.texto}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function TuRol({ rol }) {
  const info = ROLES[rol];
  const Icono = info.icono;

  return (
    <>
      <section className={styles.card} aria-labelledby="rol-titulo">
        <div className={styles.roleHead}>
          <span className={styles.roleIcon}>
            <Icono size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="rol-titulo">Eres {info.etiqueta.toLowerCase()}</h2>
            <p className="muted">{info.resumen}</p>
          </div>
        </div>
        <ul className={styles.capacidades}>
          {info.capacidades.map((c) => (
            <li key={c}>
              <Check size={16} aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.card} ${styles.quiet}`}>
        <BellRing size={20} aria-hidden="true" />
        <p>
          Si se activa una alerta de emergencia en tu sede, la verás aquí de inmediato, con las
          instrucciones para actuar.
        </p>
      </section>
    </>
  );
}

export default function HomePage() {
  const { session, can } = useAuth();
  const { usuario, empresa } = session;
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Mensaje de bienvenida tras registrar la empresa o aceptar una invitación.
  // El ref evita mostrarlo dos veces para la misma navegación.
  const bienvenida = location.state?.bienvenida;
  const bienvenidaMostrada = useRef(null);
  useEffect(() => {
    if (!bienvenida || bienvenidaMostrada.current === location.key) return;
    bienvenidaMostrada.current = location.key;
    toast(
      bienvenida === 'registro'
        ? 'Tu empresa quedó registrada. Eres su administrador.'
        : `Te damos la bienvenida a ${empresa.razonSocial.replace(/\.$/, '')}.`
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [bienvenida, empresa.razonSocial, location.key, location.pathname, navigate, toast]);

  const esAdmin = can(PERMISOS.USUARIOS_GESTIONAR);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className="eyebrow">{fechaLarga()}</p>
        <h1>
          {saludo()}, {primerNombre(usuario.nombre)}.
        </h1>
        <p className={styles.lead}>
          {ROLES[usuario.rol].etiqueta} en <strong>{empresa.razonSocial}</strong>
        </p>
      </header>

      <div className={styles.grid}>
        <div className={styles.primary}>
          {esAdmin ? <PrimerosPasos empresa={empresa} /> : <TuRol rol={usuario.rol} />}
        </div>

        <aside className={styles.secondary}>
          <section className={styles.card} aria-labelledby="empresa-titulo">
            <h2 id="empresa-titulo" className={styles.small}>
              Tu empresa
            </h2>
            <dl className={styles.facts}>
              <div>
                <dt>NIT</dt>
                <dd className={styles.mono}>{empresa.nit}</dd>
              </div>
              <div>
                <dt>Sector</dt>
                <dd>{empresa.sector}</dd>
              </div>
              <div>
                <dt>Trabajadores</dt>
                <dd>{formatearNumero(empresa.numEmpleados)}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.norma}>
            <Scale size={18} aria-hidden="true" />
            <div>
              <p className={styles.normaTitle}>Lo que pide la norma</p>
              <p>{obligacion(empresa.numEmpleados)}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
