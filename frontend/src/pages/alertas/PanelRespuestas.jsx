// HU-10: Panel del brigadista para monitorear en tiempo real el estado del personal.
import { CheckCircle2, Clock, LifeBuoy, Radio, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Avatar from '../../components/Avatar.jsx';
import Button from '../../components/Button.jsx';
import { api } from '../../lib/api.js';
import { tiempoRelativo } from '../../lib/format.js';
import { useRealtimeEvent, useRealtimeRoom } from '../../lib/useRealtime.js';
import styles from './PanelRespuestas.module.css';

export default function PanelRespuestas({ alerta }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  // Sala WebSocket de la alerta activa para recibir eventos instantáneos
  useRealtimeRoom(alerta?.id ? `alerta:${alerta.id}` : null);

  const cargar = useCallback(async () => {
    if (!alerta?.id) return;
    setCargando(true);
    setError(null);
    try {
      const res = await api(`/api/alertas/${alerta.id}/respuestas`);
      setDatos(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [alerta?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Actualización en tiempo real vía WebSocket cuando alguien confirma su estado
  const onNuevaRespuesta = useCallback((respuesta) => {
    if (!respuesta || !respuesta.usuario) return;

    setDatos((prev) => {
      if (!prev) return prev;

      // Remover de pendientes
      const nuevosPendientes = (prev.pendientes ?? []).filter(
        (p) => p.usuario.id !== respuesta.usuario.id
      );

      // Actualizar o agregar en respuestas
      const respuestasExistentes = prev.respuestas ?? [];
      const yaExiste = respuestasExistentes.some(
        (r) => r.usuario.id === respuesta.usuario.id
      );

      const nuevasRespuestas = yaExiste
        ? respuestasExistentes.map((r) =>
            r.usuario.id === respuesta.usuario.id ? respuesta : r
          )
        : [respuesta, ...respuestasExistentes];

      return {
        respuestas: nuevasRespuestas,
        pendientes: nuevosPendientes,
      };
    });
  }, []);

  useRealtimeEvent('alerta:respuesta', onNuevaRespuesta);

  if (!alerta) return null;

  const respuestas = datos?.respuestas ?? [];
  const pendientes = datos?.pendientes ?? [];

  const aSalvo = respuestas.filter((r) => r.estado === 'a_salvo');
  const necesitanAyuda = respuestas.filter((r) => r.estado === 'necesita_ayuda');

  const total = aSalvo.length + necesitanAyuda.length + pendientes.length;
  const porcentaje = total > 0 ? Math.round(((aSalvo.length + necesitanAyuda.length) / total) * 100) : 0;

  return (
    <section className={styles.panel} aria-labelledby="brigadista-panel-titulo">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3 id="brigadista-panel-titulo">Control de evacuación y personal</h3>
          <p className="muted">
            Monitoreo en tiempo real de quién está a salvo y quién requiere auxilio.
          </p>
        </div>

        <div className={styles.liveBadge} title="Conexión en tiempo real activa vía WebSocket">
          <span className={styles.liveDot} aria-hidden="true" />
          <Radio size={14} aria-hidden="true" />
          <span>Tiempo real</span>
        </div>
      </div>

      {error && (
        <Alert
          tone="error"
          action={
            <Button size="sm" variant="secondary" onClick={cargar}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Tarjetas resumen de conteo */}
      <div className={styles.kpis}>
        <button
          type="button"
          className={`${styles.kpiCard} ${styles.kpiSafe} ${filtro === 'a_salvo' ? styles.kpiActive : ''}`}
          onClick={() => setFiltro(filtro === 'a_salvo' ? 'todos' : 'a_salvo')}
        >
          <div className={styles.kpiTop}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>A salvo</span>
          </div>
          <strong>{aSalvo.length}</strong>
        </button>

        <button
          type="button"
          className={`${styles.kpiCard} ${styles.kpiHelp} ${filtro === 'necesita_ayuda' ? styles.kpiActive : ''}`}
          onClick={() => setFiltro(filtro === 'necesita_ayuda' ? 'todos' : 'necesita_ayuda')}
        >
          <div className={styles.kpiTop}>
            <LifeBuoy size={18} aria-hidden="true" />
            <span>Necesitan ayuda</span>
          </div>
          <strong>{necesitanAyuda.length}</strong>
        </button>

        <button
          type="button"
          className={`${styles.kpiCard} ${styles.kpiPending} ${filtro === 'pendientes' ? styles.kpiActive : ''}`}
          onClick={() => setFiltro(filtro === 'pendientes' ? 'todos' : 'pendientes')}
        >
          <div className={styles.kpiTop}>
            <Clock size={18} aria-hidden="true" />
            <span>Pendientes</span>
          </div>
          <strong>{pendientes.length}</strong>
        </button>
      </div>

      {/* Barra de progreso de confirmaciones */}
      <div className={styles.progressSection}>
        <div className={styles.progressLabels}>
          <span>Avance de confirmación</span>
          <strong>{porcentaje}% ({aSalvo.length + necesitanAyuda.length} de {total})</strong>
        </div>
        <div className={styles.progressBar} role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      {/* Lista detallada de personas */}
      {cargando && !datos ? (
        <div className={styles.loading} aria-busy="true">
          <span className="spinner" />
          <span className="visually-hidden">Cargando respuestas</span>
        </div>
      ) : (
        <div className={styles.lists}>
          {/* Alertas de personas que necesitan auxilio urgente */}
          {necesitanAyuda.length > 0 && (filtro === 'todos' || filtro === 'necesita_ayuda') && (
            <div className={styles.groupDanger}>
              <h4>
                <LifeBuoy size={18} aria-hidden="true" />
                Personas que requieren auxilio ({necesitanAyuda.length})
              </h4>
              <ul className={styles.personList}>
                {necesitanAyuda.map((item) => (
                  <li key={item.usuario.id} className={styles.personRowHelp}>
                    <Avatar nombre={item.usuario.nombre} size={36} />
                    <div className={styles.personBody}>
                      <strong>{item.usuario.nombre}</strong>
                      {item.mensaje ? (
                        <p className={styles.helpMessage}>"{item.mensaje}"</p>
                      ) : (
                        <span className="muted">No adjuntó mensaje adicional.</span>
                      )}
                    </div>
                    <span className={styles.timestamp}>
                      {tiempoRelativo(item.respondidoEn)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Personas a salvo */}
          {aSalvo.length > 0 && (filtro === 'todos' || filtro === 'a_salvo') && (
            <div className={styles.groupSafe}>
              <h4>
                <CheckCircle2 size={18} aria-hidden="true" />
                A salvo ({aSalvo.length})
              </h4>
              <ul className={styles.personList}>
                {aSalvo.map((item) => (
                  <li key={item.usuario.id} className={styles.personRow}>
                    <Avatar nombre={item.usuario.nombre} size={34} />
                    <div className={styles.personBody}>
                      <strong>{item.usuario.nombre}</strong>
                      <span className="muted">{item.usuario.correo}</span>
                    </div>
                    <span className={styles.timestamp}>
                      {tiempoRelativo(item.respondidoEn)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pendientes */}
          {pendientes.length > 0 && (filtro === 'todos' || filtro === 'pendientes') && (
            <div className={styles.groupPending}>
              <h4>
                <Users size={18} aria-hidden="true" />
                Pendientes por confirmar ({pendientes.length})
              </h4>
              <ul className={styles.personList}>
                {pendientes.map((item) => (
                  <li key={item.usuario.id} className={`${styles.personRow} ${styles.rowPending}`}>
                    <Avatar nombre={item.usuario.nombre} size={34} muted />
                    <div className={styles.personBody}>
                      <strong>{item.usuario.nombre}</strong>
                      <span className="muted">{item.usuario.correo}</span>
                    </div>
                    <span className={styles.pendingTag}>Sin confirmar</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
