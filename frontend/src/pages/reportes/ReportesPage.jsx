// HU-12: Pantalla de filtros y descarga de reporte de auditoría en PDF.
import {
  FileCheck2,
  FileDown,
  Filter,
  Layers,
  Scale,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { Checkbox, SelectField, TextField } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { nivelGlobal, obtenerCumplimiento } from '../../lib/cumplimiento.js';
import { descargarReporteAuditoria, SECCIONES_REPORTE } from '../../lib/reportes.js';
import styles from './ReportesPage.module.css';

// Fecha local AAAA-MM-DD (toISOString daría la de UTC y en la noche saltaría al día siguiente).
const fechaLocal = (fecha = new Date()) => fecha.toLocaleDateString('sv-SE');
const haceUnAnio = () => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() - 1);
  return fechaLocal(fecha);
};

const formatoFecha = (valor) =>
  valor
    ? new Date(`${valor}T12:00:00`).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

// HU-12: filtros por sede y rango de fechas; el backend genera el PDF.
export default function ReportesPage() {
  const { session } = useAuth();
  const toast = useToast();
  const { empresa } = session;
  const hoy = fechaLocal();

  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState(haceUnAnio);
  const [hasta, setHasta] = useState(hoy);
  const [secciones, setSecciones] = useState(() => SECCIONES_REPORTE.map((s) => s.id));
  const [cumplimiento, setCumplimiento] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    api('/api/sedes')
      .then((res) => setSedes(res.sedes ?? []))
      .catch((err) => setError(err.message));
  }, []);

  // Vista previa del estado actual de la sede elegida.
  useEffect(() => {
    const controller = new AbortController();
    setCumplimiento(null);
    obtenerCumplimiento({ sedeId: sedeId || null, signal: controller.signal })
      .then(setCumplimiento)
      .catch(() => {});
    return () => controller.abort();
  }, [sedeId]);

  const toggleSeccion = (id) => {
    setErrores((e) => ({ ...e, secciones: null }));
    setSecciones((actual) =>
      actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]
    );
  };

  const sedeSeleccionada = sedes.find((s) => s.id === sedeId);
  const sedeNombre = sedeSeleccionada ? sedeSeleccionada.nombre : 'Todas las sedes';

  function validar() {
    const nuevos = {};
    if (!desde) nuevos.desde = 'Elige la fecha inicial.';
    if (!hasta) nuevos.hasta = 'Elige la fecha final.';
    else if (hasta > hoy) nuevos.hasta = 'La fecha final no puede ser futura.';
    if (desde && hasta && desde > hasta) nuevos.desde = 'Debe ser anterior a la fecha final.';
    if (!secciones.length) nuevos.secciones = 'Elige al menos una sección.';
    return nuevos;
  }

  async function handleDescargar(e) {
    e.preventDefault();
    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setDescargando(true);
    setError(null);
    try {
      await descargarReporteAuditoria({ sedeId, desde, hasta, secciones });
      toast('Reporte descargado.');
    } catch (err) {
      const campos = err.campos ?? {};
      setErrores(campos);
      if (!Object.keys(campos).length) setError(err.message);
    } finally {
      setDescargando(false);
    }
  }

  const nivel =
    cumplimiento && !cumplimiento.sinSedes ? nivelGlobal(cumplimiento.porcentajeGlobal) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Reporte para auditoría</h1>
          <p className="muted">
            Descarga en PDF el plan, las brigadas, los simulacros y el inventario para presentarlos en una auditoría.
          </p>
        </div>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.layout}>
        {/* Formulario de filtros */}
        <section className={styles.card} aria-labelledby="filtros-titulo">
          <div className={styles.cardHead}>
            <div className={styles.iconCircle}>
              <Filter size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="filtros-titulo">Parámetros del reporte</h2>
              <p className="muted">
                Filtra por sede y rango de fechas para presentar ante el auditor o la ARL.
              </p>
            </div>
          </div>

          <form onSubmit={handleDescargar} className={styles.form} noValidate>
            <div className={styles.fieldGroup}>
              <SelectField
                label="Sede a auditar"
                className={styles.sedeSelect}
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
              >
                <option value="">Todas las sedes ({sedes.length})</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {s.ciudad}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className={styles.datesGrid}>
              <TextField
                label="Desde"
                className={styles.dateInput}
                type="date"
                value={desde}
                max={hasta || hoy}
                onChange={(e) => setDesde(e.target.value)}
                error={errores.desde}
              />
              <TextField
                label="Hasta"
                className={styles.dateInput}
                type="date"
                value={hasta}
                min={desde || undefined}
                max={hoy}
                onChange={(e) => setHasta(e.target.value)}
                error={errores.hasta}
              />
            </div>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <Layers size={16} aria-hidden="true" />
                <span>Secciones incluidas en el documento</span>
              </legend>

              <div className={styles.checkboxList}>
                {SECCIONES_REPORTE.map((s) => (
                  <div key={s.id} className={styles.checkboxItem}>
                    <Checkbox
                      id={`sec-${s.id}`}
                      label={s.label}
                      checked={secciones.includes(s.id)}
                      onChange={() => toggleSeccion(s.id)}
                    />
                    <p className={styles.itemHint}>{s.descripcion}</p>
                  </div>
                ))}
              </div>
              {errores.secciones && <p className={styles.fieldError}>{errores.secciones}</p>}
            </fieldset>

            <div className={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={FileDown}
                loading={descargando}
              >
                Descargar reporte en PDF
              </Button>
            </div>
          </form>
        </section>

        {/* Resumen lateral y fundamentación normativa */}
        <aside className={styles.side}>
          <div className={styles.cardPreview}>
            <div className={styles.previewHead}>
              <FileCheck2 size={24} className={styles.previewIcon} aria-hidden="true" />
              <div>
                <h3>Contenido del documento</h3>
                <span className="muted">PDF para descargar</span>
              </div>
            </div>

            <dl className={styles.summaryList}>
              <div>
                <dt>Empresa</dt>
                <dd><strong>{empresa.razonSocial}</strong></dd>
              </div>
              <div>
                <dt>NIT</dt>
                <dd>{empresa.nit}</dd>
              </div>
              <div>
                <dt>Alcance</dt>
                <dd>{sedeNombre}</dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>{formatoFecha(desde)} al {formatoFecha(hasta)}</dd>
              </div>
              <div>
                <dt>Secciones activas</dt>
                <dd>
                  <span className={styles.badge}>{secciones.length} de {SECCIONES_REPORTE.length}</span>
                </dd>
              </div>
              <div>
                <dt>Cumplimiento hoy</dt>
                <dd>
                  {nivel ? (
                    <span className={`${styles.badge} ${styles[`nivel_${nivel.estado}`] ?? ''}`}>
                      {cumplimiento.porcentajeGlobal}%
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.normaBox}>
            <Scale size={20} aria-hidden="true" />
            <div>
              <strong>Resolución 0312 de 2019</strong>
              <p>
                Los estándares mínimos de seguridad y salud en el trabajo exigen conservar
                evidencia documental del plan de emergencias, la brigada y los simulacros
                realizados.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
