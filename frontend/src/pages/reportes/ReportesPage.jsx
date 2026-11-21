// HU-12: Pantalla de filtros y descarga de reporte de auditoría en PDF.
import {
  Calendar,
  CheckCircle2,
  FileCheck2,
  FileDown,
  FileText,
  Filter,
  Layers,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { Checkbox, SelectField, TextField } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { descargarReporteAuditoria, SECCIONES_REPORTE } from '../../lib/reportes.js';
import { obtenerDatosCumplimiento } from '../../lib/cumplimiento.js';
import styles from './ReportesPage.module.css';

export default function ReportesPage() {
  const { session } = useAuth();
  const toast = useToast();
  const { empresa } = session;

  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState(() => {
    const añoActual = new Date().getFullYear();
    return `${añoActual}-01-01`;
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [secciones, setSecciones] = useState(() =>
    SECCIONES_REPORTE.map((s) => s.id)
  );
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resSedes, resBrigadas] = await Promise.all([
        api('/api/sedes').catch(() => ({ sedes: [] })),
        api('/api/brigadas').catch(() => ({ brigadas: [] })),
      ]);

      const listaSedes = resSedes.sedes ?? [];
      setSedes(listaSedes);

      const equiposPorSede = await Promise.all(
        listaSedes.map((sede) =>
          api(`/api/sedes/${sede.id}/equipos`).catch(() => ({ equipos: [] }))
        )
      );
      const totalEquipos = equiposPorSede.reduce(
        (total, resultado) => total + (resultado.equipos?.length ?? 0),
        0
      );

      const planesAprobados = listaSedes.filter(
        (s) => s.plan?.estado === 'aprobado'
      ).length;

      const cumplimientoData = await obtenerDatosCumplimiento({
        sedeId: sedeId || null,
      });

      const indicadorBrigadas = cumplimientoData.indicadores?.find((item) => item.id === 'brigadas');
      const brigadasTexto = indicadorBrigadas?.resumen || '';
      const porcentajeGlobal = cumplimientoData.porcentajeGlobal;
      const nivel = porcentajeGlobal >= 85
        ? 'Nivel de cumplimiento óptimo'
        : porcentajeGlobal >= 60
          ? 'Cumplimiento aceptable con planes de acción pendientes'
          : 'Nivel crítico: requiere atención prioritaria';

      setResumen({
        totalSedes: listaSedes.length,
        planesAprobados,
        totalBrigadas: (resBrigadas.brigadas ?? []).length,
        brigadasTexto,
        totalEquipos,
        porcentajeGlobal,
        nivel,
        indicadores: cumplimientoData.indicadores,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [sedeId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const toggleSeccion = (id) => {
    setSecciones((actual) =>
      actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]
    );
  };

  const sedeSeleccionada = sedes.find((s) => s.id === sedeId);
  const sedeNombre = sedeSeleccionada ? sedeSeleccionada.nombre : 'Todas las sedes';

  async function handleDescargar(e) {
    e.preventDefault();
    if (secciones.length === 0) {
      toast('Selecciona al menos una sección para el reporte.', { tone: 'error' });
      return;
    }

    setDescargando(true);
    try {
      const cumplimientoData = await obtenerDatosCumplimiento({ sedeId: sedeId || null });
      const porcentajeGlobal = cumplimientoData.porcentajeGlobal;
      const nivel = porcentajeGlobal >= 85
        ? 'Nivel de cumplimiento óptimo'
        : porcentajeGlobal >= 60
          ? 'Cumplimiento aceptable con planes de acción pendientes'
          : 'Nivel crítico: requiere atención prioritaria';
      const indicadorBrigadas = cumplimientoData.indicadores?.find((item) => item.id === 'brigadas');

      await descargarReporteAuditoria({
        sedeId,
        desde,
        hasta,
        secciones,
        empresa,
        sedeNombre,
        resumen: {
          ...resumen,
          porcentajeGlobal,
          nivel,
          brigadasTexto: indicadorBrigadas?.resumen || resumen?.brigadasTexto,
          indicadores: cumplimientoData.indicadores,
        },
      });
      toast('Reporte de auditoría descargado en PDF.');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Reporte para auditoría</h1>
          <p className="muted">
            Genera y descarga el documento consolidado de cumplimiento SG-SST en formato PDF.
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
                label="Fecha inicial"
                className={styles.dateInput}
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
              <TextField
                label="Fecha de corte"
                className={styles.dateInput}
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
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
            </fieldset>

            <div className={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={FileDown}
                loading={descargando}
                disabled={cargando || secciones.length === 0}
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
                <span className="muted">Formato PDF oficial</span>
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
                <dd>{desde || 'Inicio'} a {hasta || 'Hoy'}</dd>
              </div>
              <div>
                <dt>Secciones activas</dt>
                <dd>
                  <span className={styles.badge}>{secciones.length} de {SECCIONES_REPORTE.length}</span>
                </dd>
              </div>
              <div>
                <dt>Equipos registrados</dt>
                <dd>
                  <span className={styles.badge}>{resumen?.totalEquipos || 0}</span>
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
