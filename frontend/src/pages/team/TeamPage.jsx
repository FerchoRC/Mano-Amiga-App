import {
  Ellipsis,
  KeyRound,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Avatar from '../../components/Avatar.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import Menu from '../../components/Menu.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { primerNombre, tiempoRelativo } from '../../lib/format.js';
import { etiquetaRol, LISTA_ROLES } from '../../lib/roles.js';
import AddPersonDialog from './AddPersonDialog.jsx';
import ResetPasswordDialog from './ResetPasswordDialog.jsx';
import InviteLink from './InviteLink.jsx';
import styles from './Team.module.css';

const FILTROS_ESTADO = [
  { id: 'todos', texto: 'Todos los estados' },
  { id: 'activo', texto: 'Activos' },
  { id: 'pendiente', texto: 'Invitaciones pendientes' },
  { id: 'inactivo', texto: 'Inactivos' },
];

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Textos de los diálogos de confirmación según la acción.
function textosConfirmacion({ tipo, usuario, rol }) {
  const nombre = primerNombre(usuario.nombre);
  switch (tipo) {
    case 'desactivar':
      return {
        titulo: `¿Desactivar a ${nombre}?`,
        texto: 'Perderá el acceso de inmediato y se cerrarán sus sesiones abiertas. Podrás reactivarlo cuando quieras.',
        boton: 'Desactivar',
        tono: 'danger',
      };
    case 'cancelar':
      return {
        titulo: `¿Cancelar la invitación de ${nombre}?`,
        texto: 'El enlace dejará de funcionar. Si cambias de opinión, puedes invitarlo de nuevo.',
        boton: 'Cancelar invitación',
        tono: 'danger',
      };
    case 'rol':
      return {
        titulo: `¿Hacer administrador a ${nombre}?`,
        texto: 'Podrá configurar la empresa y gestionar a todo el equipo, incluido cambiar roles y desactivar personas.',
        boton: 'Hacer administrador',
        tono: 'primary',
        rol,
      };
    default:
      return null;
  }
}

function RoleSelect({ usuario, onChange, disabled }) {
  return (
    <select
      className={styles.roleSelect}
      value={usuario.rol}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={`Rol de ${usuario.nombre}`}
    >
      {LISTA_ROLES.map((rol) => (
        <option key={rol.id} value={rol.id}>
          {rol.etiqueta}
        </option>
      ))}
    </select>
  );
}

function UserRow({ usuario, esYo, ocupado, onRol, onAccion }) {
  const acceso =
    usuario.estado === 'pendiente'
      ? 'Aún no ha ingresado'
      : (tiempoRelativo(usuario.ultimoAcceso) ?? 'Nunca ha ingresado');

  const acciones =
    usuario.estado === 'pendiente'
      ? [
          { label: 'Darle acceso con contraseña', icon: KeyRound, onSelect: () => onAccion('contrasena') },
          { label: 'Generar nuevo enlace', icon: RefreshCw, onSelect: () => onAccion('reenviar') },
          { label: 'Cancelar invitación', icon: X, tone: 'danger', onSelect: () => onAccion('cancelar') },
        ]
      : [
          { label: 'Restablecer contraseña', icon: KeyRound, onSelect: () => onAccion('contrasena') },
          usuario.estado === 'activo'
            ? { label: 'Desactivar acceso', icon: UserX, tone: 'danger', onSelect: () => onAccion('desactivar') }
            : { label: 'Reactivar acceso', icon: UserCheck, onSelect: () => onAccion('reactivar') },
        ];

  return (
    <li className={`${styles.row} ${usuario.estado === 'inactivo' ? styles.rowInactive : ''}`}>
      <div className={styles.person}>
        <Avatar nombre={usuario.nombre} muted={usuario.estado !== 'activo'} />
        <div className={styles.personText}>
          <p className={styles.personName}>
            {usuario.nombre}
            {esYo && <span className={styles.youTag}>Tú</span>}
          </p>
          <p className={styles.personMail}>{usuario.correo}</p>
        </div>
      </div>

      <div className={styles.cellRole}>
        {esYo ? (
          <span className={styles.roleStatic} title="No puedes cambiar tu propio rol">
            {etiquetaRol(usuario.rol)}
          </span>
        ) : (
          <RoleSelect usuario={usuario} onChange={onRol} disabled={ocupado} />
        )}
      </div>

      <div className={styles.cellStatus}>
        <StatusBadge estado={usuario.estado} />
        {usuario.estado === 'pendiente' && usuario.invitacionExpiraEn && (
          <span className={styles.subtle}>
            {new Date(usuario.invitacionExpiraEn) < new Date()
              ? 'El enlace venció'
              : `Vence ${tiempoRelativo(usuario.invitacionExpiraEn)?.toLowerCase()}`}
          </span>
        )}
        {usuario.estado === 'activo' && usuario.contrasenaTemporal && (
          <span className={styles.subtle}>Con contraseña temporal</span>
        )}
      </div>

      <div className={styles.cellAccess}>{acceso}</div>

      <div className={styles.cellActions}>
        {!esYo && (
          <Menu
            label={`Acciones para ${usuario.nombre}`}
            trigger={ocupado ? <span className="spinner" /> : <Ellipsis size={18} aria-hidden="true" />}
            items={acciones}
          />
        )}
      </div>
    </li>
  );
}

// HU-03: el administrador invita personas, asigna su rol y puede cambiarlo o desactivarlas.
export default function TeamPage() {
  const { session } = useAuth();
  const toast = useToast();

  const [usuarios, setUsuarios] = useState(null);
  const [cargaError, setCargaError] = useState(null);
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [restablecer, setRestablecer] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [enlace, setEnlace] = useState(null);
  const [ocupados, setOcupados] = useState(() => new Set());
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    setCargaError(null);
    try {
      const { usuarios } = await api('/api/usuarios');
      setUsuarios(usuarios);
    } catch (err) {
      setCargaError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reemplazar = (actualizado) =>
    setUsuarios((lista) => lista.map((u) => (u.id === actualizado.id ? actualizado : u)));

  // Ejecuta una acción sobre un usuario mostrando su fila como ocupada.
  // Devuelve { ok, data }; los errores se muestran como aviso.
  async function conUsuario(usuario, accion) {
    setOcupados((s) => new Set(s).add(usuario.id));
    try {
      return { ok: true, data: await accion() };
    } catch (err) {
      toast(err.message, { tone: 'error' });
      return { ok: false };
    } finally {
      setOcupados((s) => {
        const copia = new Set(s);
        copia.delete(usuario.id);
        return copia;
      });
    }
  }

  async function actualizar(usuario, cambios, mensaje) {
    const { ok, data } = await conUsuario(usuario, () =>
      api(`/api/usuarios/${usuario.id}`, { method: 'PATCH', body: cambios })
    );
    if (ok) {
      reemplazar(data.usuario);
      toast(mensaje);
    }
  }

  const cambiarRol = (usuario, rol) => {
    if (rol === 'administrador') {
      setConfirmacion({ tipo: 'rol', usuario, rol });
      return;
    }
    actualizar(usuario, { rol }, `${primerNombre(usuario.nombre)} ahora es ${etiquetaRol(rol).toLowerCase()}.`);
  };

  async function onAccion(usuario, tipo) {
    if (tipo === 'reenviar') {
      const { ok, data } = await conUsuario(usuario, () =>
        api(`/api/usuarios/${usuario.id}/invitacion`, { method: 'POST' })
      );
      if (ok) {
        reemplazar(data.usuario);
        setEnlace(data);
      }
    } else if (tipo === 'reactivar') {
      actualizar(usuario, { activo: true }, `${primerNombre(usuario.nombre)} recuperó el acceso.`);
    } else if (tipo === 'contrasena') {
      setRestablecer(usuario);
    } else {
      setConfirmacion({ tipo, usuario });
    }
  }

  async function confirmar() {
    const { tipo, usuario, rol } = confirmacion;
    setConfirmando(true);
    if (tipo === 'desactivar') {
      await actualizar(usuario, { activo: false }, `${primerNombre(usuario.nombre)} ya no tiene acceso.`);
    } else if (tipo === 'rol') {
      await actualizar(usuario, { rol }, `${primerNombre(usuario.nombre)} ahora es administrador.`);
    } else if (tipo === 'cancelar') {
      const { ok } = await conUsuario(usuario, () =>
        api(`/api/usuarios/${usuario.id}`, { method: 'DELETE' })
      );
      if (ok) {
        setUsuarios((lista) => lista.filter((u) => u.id !== usuario.id));
        toast('Invitación cancelada.');
      }
    }
    setConfirmando(false);
    setConfirmacion(null);
  }

  const conteo = useMemo(() => {
    const base = { todos: usuarios?.length ?? 0 };
    for (const u of usuarios ?? []) base[u.rol] = (base[u.rol] ?? 0) + 1;
    return base;
  }, [usuarios]);

  const pendientes = usuarios?.filter((u) => u.estado === 'pendiente').length ?? 0;

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return (usuarios ?? []).filter(
      (u) =>
        (filtroRol === 'todos' || u.rol === filtroRol) &&
        (filtroEstado === 'todos' || u.estado === filtroEstado) &&
        (!q || normalizar(`${u.nombre} ${u.correo}`).includes(q))
    );
  }, [usuarios, filtroRol, filtroEstado, busqueda]);

  const textos = confirmacion && textosConfirmacion(confirmacion);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Equipo</h1>
          <p className="muted">
            Agrega a las personas de tu empresa y define qué puede ver y hacer cada una.
          </p>
        </div>
        <Button icon={UserPlus} onClick={() => setAgregarAbierto(true)}>
          Agregar persona
        </Button>
      </header>

      {cargaError ? (
        <Alert
          tone="error"
          title="No pudimos cargar tu equipo"
          action={
            <Button size="sm" variant="secondary" onClick={cargar}>
              Reintentar
            </Button>
          }
        >
          {cargaError}
        </Alert>
      ) : (
        <section className={styles.panel} aria-label="Personas de la empresa">
          <div className={styles.toolbar}>
            <div className={styles.segmented} role="group" aria-label="Filtrar por rol">
              {[{ id: 'todos', plural: 'Todos' }, ...LISTA_ROLES].map((rol) => (
                <button
                  key={rol.id}
                  type="button"
                  aria-pressed={filtroRol === rol.id}
                  onClick={() => setFiltroRol(rol.id)}
                >
                  {rol.plural}
                  <span className={styles.count}>{conteo[rol.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className={styles.filters}>
              <label className={styles.search}>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Buscar por nombre o correo"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  aria-label="Buscar por nombre o correo"
                />
              </label>
              <select
                className={styles.stateSelect}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                aria-label="Filtrar por estado"
              >
                {FILTROS_ESTADO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id === 'pendiente' && pendientes ? `${f.texto} (${pendientes})` : f.texto}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.listHead} aria-hidden="true">
            <span>Persona</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Último acceso</span>
            <span />
          </div>

          {usuarios === null ? (
            <ul className={styles.list} aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className={`${styles.row} ${styles.skeleton}`}>
                  <div className={styles.person}>
                    <span className={styles.skelAvatar} />
                    <span className={styles.skelLine} />
                  </div>
                </li>
              ))}
            </ul>
          ) : visibles.length === 0 ? (
            <div className={styles.empty}>
              <p>Nadie coincide con los filtros.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltroRol('todos');
                  setFiltroEstado('todos');
                  setBusqueda('');
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <ul className={styles.list}>
              {visibles.map((usuario) => (
                <UserRow
                  key={usuario.id}
                  usuario={usuario}
                  esYo={usuario.id === session.usuario.id}
                  ocupado={ocupados.has(usuario.id)}
                  onRol={(rol) => cambiarRol(usuario, rol)}
                  onAccion={(tipo) => onAccion(usuario, tipo)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.legend} aria-labelledby="roles-titulo">
        <h2 id="roles-titulo" className={styles.legendTitle}>
          Qué puede hacer cada rol
        </h2>
        <div className={styles.legendGrid}>
          {LISTA_ROLES.map((rol) => {
            const Icono = rol.icono;
            return (
              <article key={rol.id} className={styles.legendItem}>
                <p className={styles.legendName}>
                  <Icono size={18} aria-hidden="true" />
                  {rol.etiqueta}
                </p>
                <ul>
                  {rol.capacidades.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <AddPersonDialog
        open={agregarAbierto}
        onClose={() => setAgregarAbierto(false)}
        onAdded={(nuevo) => setUsuarios((lista) => [...(lista ?? []), nuevo])}
      />

      <ResetPasswordDialog
        usuario={restablecer}
        onClose={() => setRestablecer(null)}
        onUpdated={reemplazar}
      />

      <Dialog
        open={Boolean(confirmacion)}
        onClose={() => !confirmando && setConfirmacion(null)}
        size="sm"
        title={textos?.titulo}
        description={textos?.texto}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmacion(null)} disabled={confirmando}>
              Volver
            </Button>
            <Button variant={textos?.tono} onClick={confirmar} loading={confirmando}>
              {textos?.boton}
            </Button>
          </>
        }
      />

      <Dialog
        open={Boolean(enlace)}
        onClose={() => setEnlace(null)}
        title="Nuevo enlace de invitación"
        description="El enlace anterior dejó de funcionar."
        footer={<Button onClick={() => setEnlace(null)}>Listo</Button>}
      >
        {enlace && (
          <InviteLink
            nombre={enlace.usuario.nombre}
            correo={enlace.usuario.correo}
            enlace={enlace.enlace}
            correoEnviado={enlace.correoEnviado}
            expiraEn={enlace.usuario.invitacionExpiraEn}
          />
        )}
      </Dialog>
    </div>
  );
}
