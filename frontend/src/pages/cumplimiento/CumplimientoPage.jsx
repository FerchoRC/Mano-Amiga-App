// HU-13: Panel de cumplimiento
// Como administrador, quiero ver un panel con el nivel de cumplimiento de mi empresa
// (plan aprobado, simulacros hechos, equipos al día) para saber qué me falta.

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import { SelectField } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { nivelGlobal, obtenerCumplimiento } from '../../lib/cumplimiento.js';
import IndicadorCard from './IndicadorCard.jsx';
import IndicadorDetalleDialog from './IndicadorDetalleDialog.jsx';
import styles from './CumplimientoPage.module.css';

const CLASE_NIVEL = {
  verde: { texto: styles.nivelCumplido, barra: styles.resumenRellenoVerde },
  amarillo: { texto: styles.nivelEnProgreso, barra: styles.resumenRellenoAmarillo },
  rojo: { texto: styles.nivelCritico, barra: styles.resumenRellenoRojo },
};

export default function CumplimientoPage() {
  const [datos, setDatos] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [indicadorActivo, setIndicadorActivo] = useState(null);

  useEffect(() => {
    api('/api/sedes')
      .then((res) => setSedes(res.sedes ?? []))
      .catch(() => {});
  }, []);

  const cargar = useCallback(
    async (signal) => {
      setCargando(true);
      setError(null);
      try {
        setDatos(await obtenerCumplimiento({ sedeId: sedeSeleccionada || null, signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [sedeSeleccionada]
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  if (cargando && !datos) {
    return (
      <div className={styles.estado} aria-busy="true">
        <span className="spinner" />
        <p className="muted">Evaluando el cumplimiento…</p>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className={styles.container}>
        <Alert
          tone="error"
          title="No pudimos cargar el panel"
          action={
            <Button size="sm" variant="secondary" onClick={() => cargar()}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      </div>
    );
  }

  if (datos.sinSedes) {
    return (
      <div className={styles.estado}>
        <Building2 size={28} aria-hidden="true" />
        <h1 className={styles.estadoTitulo}>Primero registra tus sedes</h1>
        <p className="muted">
          El cumplimiento se evalúa sede por sede: plan, brigadas, simulacros, equipos y mapa.
        </p>
        <Button to="/sedes/nueva">Registrar sede</Button>
      </div>
    );
  }

  const { indicadores = [], porcentajeGlobal = 0, resumen } = datos;
  const { cumplidos, enProgreso, criticos } = resumen;
  const nivel = nivelGlobal(porcentajeGlobal);
  const clases = CLASE_NIVEL[nivel.estado];

  return (
    <div className={styles.container}>
      {/* Encabezado */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerCopy}>
            <h1 className={styles.titulo}>Panel de cumplimiento</h1>
            <p className="muted">
              Monitoreo del estándar de emergencias SG-SST (Resolución 0312 de 2019 y Decreto 1072 de 2015).
            </p>
          </div>

          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => cargar()}
              loading={cargando}
            >
              Actualizar
            </Button>
            <Button
              to="/reportes"
              variant="primary"
              size="sm"
              icon={Download}
            >
              Reporte para auditoría
            </Button>
          </div>
        </div>

        {/* Filtro por sede */}
        <div className={styles.filtroSede}>
          <SelectField
            label="Filtrar por sede"
            hint="Consolida los indicadores de las sedes seleccionadas."
            value={sedeSeleccionada}
            onChange={(e) => setSedeSeleccionada(e.target.value)}
          >
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </SelectField>
        </div>
      </header>

      {/* Resumen general */}
      <section className={styles.resumenBanner} aria-label="Resumen general de cumplimiento">
        <div className={styles.resumenPorcentaje}>
          <span className={`${styles.porcentajeNumero} ${clases.texto}`}>{porcentajeGlobal}%</span>
          <span className={styles.porcentajeEtiqueta}>Cumplimiento</span>
        </div>

        <div className={styles.resumenDetalles}>
          <h2 className={`${styles.resumenTitulo} ${clases.texto}`}>{nivel.titulo}</h2>
          <p className={styles.resumenTexto}>
            {indicadores.length} indicadores calculados con los datos de tu empresa al día de hoy.
            Toca uno para ver qué falta.
          </p>

          <div className={styles.conteoIndicadores}>
            <span className={`${styles.conteoPill} ${styles.pillVerde}`}>
              <CheckCircle2 aria-hidden="true" size={15} />
              {cumplidos} {cumplidos === 1 ? 'cumplido' : 'cumplidos'}
            </span>
            <span className={`${styles.conteoPill} ${styles.pillAmarillo}`}>
              <AlertTriangle aria-hidden="true" size={15} />
              {enProgreso} en progreso
            </span>
            <span className={`${styles.conteoPill} ${styles.pillRojo}`}>
              <XCircle aria-hidden="true" size={15} />
              {criticos} {criticos === 1 ? 'crítico' : 'críticos'}
            </span>
          </div>

          <div
            className={styles.resumenProgreso}
            role="progressbar"
            aria-label="Porcentaje global de cumplimiento"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={porcentajeGlobal}
          >
            <span
              className={clases.barra}
              style={{ width: `${Math.min(100, Math.max(0, porcentajeGlobal))}%` }}
            />
          </div>
        </div>
      </section>

      {/* Grilla de indicadores individuales */}
      <section aria-label="Indicadores individuales">
        <div className={styles.gridIndicadores}>
          {indicadores.map((ind) => (
            <IndicadorCard
              key={ind.id}
              indicador={ind}
              onClick={(item) => setIndicadorActivo(item)}
            />
          ))}
        </div>
      </section>

      {/* Diálogo con detalle de qué falta para cumplir */}
      <IndicadorDetalleDialog
        indicador={indicadorActivo}
        open={Boolean(indicadorActivo)}
        onClose={() => setIndicadorActivo(null)}
      />
    </div>
  );
}
