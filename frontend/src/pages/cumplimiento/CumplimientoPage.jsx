// HU-13: Panel de cumplimiento
// Como administrador, quiero ver un panel con el nivel de cumplimiento de mi empresa
// (plan aprobado, simulacros hechos, equipos al día) para saber qué me falta.

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Button from '../../components/Button.jsx';
import FullScreenStatus from '../../components/FullScreenStatus.jsx';
import { SelectField } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { obtenerDatosCumplimiento } from '../../lib/cumplimiento.js';
import IndicadorCard from './IndicadorCard.jsx';
import IndicadorDetalleDialog from './IndicadorDetalleDialog.jsx';
import styles from './CumplimientoPage.module.css';

export default function CumplimientoPage() {
  const [datos, setDatos] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [indicadorActivo, setIndicadorActivo] = useState(null);
  const toast = useToast();

  // Cargar sedes para selector
  useEffect(() => {
    let cancelado = false;
    async function cargarSedes() {
      try {
        const data = await api('/sedes');
        if (!cancelado) {
          setSedes(Array.isArray(data) ? data : data?.sedes || []);
        }
      } catch (err) {
        // Silencioso; se maneja en la carga principal
      }
    }
    cargarSedes();
    return () => {
      cancelado = true;
    };
  }, []);

  // Cargar indicadores de cumplimiento
  const cargarCumplimiento = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await obtenerDatosCumplimiento({
        sedeId: sedeSeleccionada || null,
      });
      setDatos(res);
    } catch (err) {
      setError(err.message || 'No fue posible cargar el panel de cumplimiento');
      toast.show({
        type: 'error',
        message: 'Error al consultar indicadores de cumplimiento',
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCumplimiento();
  }, [sedeSeleccionada]);

  if (cargando && !datos) {
    return <FullScreenStatus status="loading" title="Evaluando cumplimiento..." />;
  }

  if (error && !datos) {
    return (
      <FullScreenStatus
        status="error"
        title="Error al cargar el panel"
        description={error}
        action={
          <Button variant="primary" onClick={cargarCumplimiento}>
            Reintentar
          </Button>
        }
      />
    );
  }

  const { indicadores = [], porcentajeGlobal = 0 } = datos || {};
  const cumplidos = indicadores.filter((i) => i.estado === 'verde').length;
  const enProgreso = indicadores.filter((i) => i.estado === 'amarillo').length;
  const criticos = indicadores.filter((i) => i.estado === 'rojo').length;

  return (
    <div className={styles.container}>
      {/* Encabezado */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.titulo}>Panel de cumplimiento</h1>
            <p className={styles.subtitulo}>
              Monitoreo del estándar de emergencias SG-SST (Resolución 0312 de 2019 y Decreto 1072 de 2015).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--espacio-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" size={16} />}
              onClick={cargarCumplimiento}
              loading={cargando}
            >
              Actualizar
            </Button>
            <Button
              to="/reportes"
              variant="primary"
              icon={<Download aria-hidden="true" size={16} />}
            >
              Reporte para auditoría
            </Button>
          </div>
        </div>

        {/* Filtro por sede */}
        <div style={{ maxWidth: '320px', marginTop: 'var(--espacio-3)' }}>
          <SelectField
            label="Filtrar por sede"
            value={sedeSeleccionada}
            onChange={(e) => setSedeSeleccionada(e.target.value)}
          >
            <option value="">Todas las sedes (consolidado empresa)</option>
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
        <div className={styles.porcentajeCirculo}>
          <span className={styles.porcentajeNumero}>{porcentajeGlobal}%</span>
          <span className={styles.porcentajeEtiqueta}>Cumplimiento</span>
        </div>

        <div className={styles.resumenDetalles}>
          <h2 className={styles.resumenTitulo}>
            {porcentajeGlobal >= 85
              ? 'Nivel de cumplimiento óptimo'
              : porcentajeGlobal >= 60
              ? 'Cumplimiento aceptable con planes de acción pendientes'
              : 'Nivel crítico: requiere atención prioritaria'}
          </h2>
          <p className={styles.resumenTexto}>
            Tienes {indicadores.length} indicadores evaluados frente a la normativa colombiana de
            preparación ante emergencias y desastres.
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
