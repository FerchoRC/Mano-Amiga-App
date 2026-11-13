// HU-11: Inventario de equipos de emergencia por sede con cálculo de vencimientos.
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import Menu from '../../components/Menu.jsx';
import SedeSelect from '../../components/SedeSelect.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import {
  diasParaVencer,
  esProximoAVencer,
  estaVencido,
  estadoEquipo,
  tipoEquipo,
  TIPOS_EQUIPO,
} from '../../lib/equipos.js';
import { fechaCorta } from '../../lib/format.js';
import { PERMISOS } from '../../lib/roles.js';
import useSedeSeleccionada from '../../lib/useSedeSeleccionada.js';
import EquipoDialog from './EquipoDialog.jsx';
import styles from './EquiposPage.module.css';

export default function EquiposPage() {
  const { can } = useAuth();
  const toast = useToast();
  const puedeGestionar = can(PERMISOS.EQUIPOS_GESTIONAR) || can(PERMISOS.SEDES_GESTIONAR);

  const { sedes, sede, setSedeId, error: errorSedes } = useSedeSeleccionada();
  const [equipos, setEquipos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [equipoAEditar, setEquipoAEditar] = useState(null);
  const [equipoAEliminar, setEquipoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    if (!sede) return;
    setCargando(true);
    setError(null);
    try {
      const res = await api(`/api/sedes/${sede.id}/equipos`);
      setEquipos(res.equipos ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [sede?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Guardar o actualizar
  const handleGuardado = (equipoGuardado) => {
    setEquipos((actual) => {
      const lista = actual ?? [];
      const existe = lista.some((e) => e.id === equipoGuardado.id);
      if (existe) {
        return lista.map((e) => (e.id === equipoGuardado.id ? equipoGuardado : e));
      }
      return [equipoGuardado, ...lista];
    });
    toast(`${equipoGuardado.nombre} fue guardado correctamente.`);
  };

  // Confirmar eliminación
  async function confirmarEliminar() {
    if (!equipoAEliminar) return;
    setEliminando(true);
    try {
      await api(`/api/equipos/${equipoAEliminar.id}`, { method: 'DELETE' });
      setEquipos((actual) => (actual ?? []).filter((e) => e.id !== equipoAEliminar.id));
      toast(`${equipoAEliminar.nombre} fue eliminado.`);
      setEquipoAEliminar(null);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setEliminando(false);
    }
  }

  // Métricas
  const estadisticas = useMemo(() => {
    const lista = equipos ?? [];
    const proximos = lista.filter((e) => esProximoAVencer(e.fechaVencimiento));
    const vencidos = lista.filter((e) => estaVencido(e.fechaVencimiento));
    const operativos = lista.filter(
      (e) => !estaVencido(e.fechaVencimiento) && !esProximoAVencer(e.fechaVencimiento)
    );
    return {
      total: lista.length,
      proximos: proximos.length,
      vencidos: vencidos.length,
      operativos: operativos.length,
    };
  }, [equipos]);

  // Lista filtrada
  const equiposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (equipos ?? []).filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      if (filtroEstado === 'proximos' && !esProximoAVencer(e.fechaVencimiento)) return false;
      if (filtroEstado === 'vencidos' && !estaVencido(e.fechaVencimiento)) return false;
      if (filtroEstado === 'operativo' && e.estado !== 'operativo') return false;
      if (q && !`${e.nombre} ${e.ubicacion} ${e.notas ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [equipos, filtroTipo, filtroEstado, busqueda]);

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
          <h1>Inventario de equipos</h1>
          <p className="muted">
            Control de extintores, botiquines y camillas con fecha de vencimiento y recarga.
          </p>
        </div>

        {puedeGestionar && sede && (
          <Button
            icon={Plus}
            onClick={() => {
              setEquipoAEditar(null);
              setDialogAbierto(true);
            }}
          >
            Registrar equipo
          </Button>
        )}
      </header>

      {sedes.length > 1 && (
        <SedeSelect sedes={sedes} value={sede?.id} onChange={setSedeId} />
      )}

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

      {/* Tarjetas de métricas y alertas preventivas */}
      {sede && (
        <div className={styles.kpis}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Total equipos</span>
            <strong className={styles.kpiValue}>{estadisticas.total}</strong>
          </div>

          <div className={`${styles.kpiCard} ${estadisticas.proximos > 0 ? styles.kpiWarning : ''}`}>
            <span className={styles.kpiLabel}>
              <Clock size={16} aria-hidden="true" />
              Próximos a vencer
            </span>
            <strong className={styles.kpiValue}>{estadisticas.proximos}</strong>
          </div>

          <div className={`${styles.kpiCard} ${estadisticas.vencidos > 0 ? styles.kpiDanger : ''}`}>
            <span className={styles.kpiLabel}>
              <AlertTriangle size={16} aria-hidden="true" />
              Vencidos / Recarga
            </span>
            <strong className={styles.kpiValue}>{estadisticas.vencidos}</strong>
          </div>

          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <CheckCircle2 size={16} aria-hidden="true" />
              Al día
            </span>
            <strong className={styles.kpiValue}>{estadisticas.operativos}</strong>
          </div>
        </div>
      )}

      {/* Barra de herramientas: búsqueda y filtros */}
      {sede && (
        <div className={styles.toolbar}>
          <div className={styles.segmented} role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              aria-pressed={filtroTipo === 'todos'}
              onClick={() => setFiltroTipo('todos')}
            >
              Todos
            </button>
            {TIPOS_EQUIPO.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={filtroTipo === t.id}
                onClick={() => setFiltroTipo(t.id)}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          <div className={styles.filters}>
            <label className={styles.search}>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar por nombre o ubicación..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar equipo"
              />
            </label>

            <select
              className={styles.filterSelect}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label="Filtrar por estado de vencimiento"
            >
              <option value="todos">Todos los estados</option>
              <option value="proximos">Próximos a vencer (≤ 30 días)</option>
              <option value="vencidos">Vencidos o caducados</option>
              <option value="operativo">Solo operativos</option>
            </select>
          </div>
        </div>
      )}

      {/* Lista / Tabla de equipos */}
      {cargando && !equipos ? (
        <div className={styles.loading} aria-busy="true">
          <span className="spinner" />
          <span className="visually-hidden">Cargando equipos</span>
        </div>
      ) : !sede ? (
        <div className={styles.empty}>
          <Boxes size={32} aria-hidden="true" />
          <p className="muted">Selecciona una sede para consultar su inventario de equipos.</p>
        </div>
      ) : equiposFiltrados.length === 0 ? (
        <div className={styles.empty}>
          <Boxes size={32} aria-hidden="true" />
          <h3>No hay equipos registrados</h3>
          <p className="muted">
            {busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos'
              ? 'Ningún equipo coincide con los filtros aplicados.'
              : 'Registra los extintores, botiquines y camillas de esta sede para controlar sus vencimientos.'}
          </p>
          {puedeGestionar && !busqueda && filtroTipo === 'todos' && filtroEstado === 'todos' && (
            <Button
              icon={Plus}
              onClick={() => {
                setEquipoAEditar(null);
                setDialogAbierto(true);
              }}
            >
              Registrar primer equipo
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Equipo</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Vencimiento / Recarga</th>
                  <th scope="col">Estado</th>
                  {puedeGestionar && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {equiposFiltrados.map((item) => {
                  const infoTipo = tipoEquipo(item.tipo);
                  const Icono = infoTipo.icono;
                  const infoEstado = estadoEquipo(item.estado);

                  const proximo = esProximoAVencer(item.fechaVencimiento);
                  const vencido = estaVencido(item.fechaVencimiento);
                  const dias = diasParaVencer(item.fechaVencimiento);

                  return (
                    <tr
                      key={item.id}
                      className={vencido ? styles.rowDanger : proximo ? styles.rowWarning : ''}
                    >
                      <td>
                        <div className={styles.cellItem}>
                          <span className={`${styles.typeIcon} ${styles[infoTipo.tono]}`}>
                            <Icono size={18} aria-hidden="true" />
                          </span>
                          <div className={styles.itemMeta}>
                            <strong>{item.nombre}</strong>
                            <span className="muted">{infoTipo.etiqueta}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={styles.cellUbicacion}>{item.ubicacion}</span>
                      </td>

                      <td>
                        {item.fechaVencimiento ? (
                          <div className={styles.vencimientoCell}>
                            <span>{fechaCorta(item.fechaVencimiento)}</span>
                            {vencido ? (
                              <span className={styles.badgeDanger}>
                                <AlertTriangle size={12} aria-hidden="true" />
                                Vencido hace {Math.abs(dias)} {Math.abs(dias) === 1 ? 'día' : 'días'}
                              </span>
                            ) : proximo ? (
                              <span className={styles.badgeWarning}>
                                <Clock size={12} aria-hidden="true" />
                                Vence en {dias} {dias === 1 ? 'día' : 'días'}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="muted">Sin fecha</span>
                        )}
                      </td>

                      <td>
                        <span className={`${styles.statusPill} ${styles[infoEstado.clase]}`}>
                          {infoEstado.etiqueta}
                        </span>
                      </td>

                      {puedeGestionar && (
                        <td className={styles.cellActions}>
                          <Menu
                            label={`Acciones para ${item.nombre}`}
                            trigger={<Ellipsis size={18} aria-hidden="true" />}
                            items={[
                              {
                                label: 'Editar equipo',
                                icon: Pencil,
                                onSelect: () => {
                                  setEquipoAEditar(item);
                                  setDialogAbierto(true);
                                },
                              },
                              {
                                label: 'Eliminar equipo',
                                icon: Trash2,
                                tone: 'danger',
                                onSelect: () => setEquipoAEliminar(item),
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialogAbierto && (
        <EquipoDialog
          open={dialogAbierto}
          sedeId={sede?.id}
          equipo={equipoAEditar}
          onClose={() => {
            setDialogAbierto(false);
            setEquipoAEditar(null);
          }}
          onSaved={handleGuardado}
        />
      )}

      <Dialog
        open={Boolean(equipoAEliminar)}
        onClose={() => !eliminando && setEquipoAEliminar(null)}
        size="sm"
        title={`¿Eliminar ${equipoAEliminar?.nombre}?`}
        description="El equipo se retirará permanentemente del inventario de esta sede."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEquipoAEliminar(null)}
              disabled={eliminando}
            >
              Volver
            </Button>
            <Button
              variant="danger"
              onClick={confirmarEliminar}
              loading={eliminando}
            >
              Eliminar equipo
            </Button>
          </>
        }
      />
    </div>
  );
}
