import {
  Boxes,
  Building2,
  Ellipsis,
  House,
  KeyRound,
  LogOut,
  Map as MapIcon,
  ShieldPlus,
  Siren,
  Users,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import { RUTA_CAMBIAR_CONTRASENA } from '../auth/guards.jsx';
import AlertaGlobal from '../components/AlertaGlobal.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/Button.jsx';
import Dialog from '../components/Dialog.jsx';
import Logo from '../components/Logo.jsx';
import Menu from '../components/Menu.jsx';
import { useToast } from '../components/Toast.jsx';
import { tipoEmergencia } from '../lib/alertas.js';
import { api } from '../lib/api.js';
import { etiquetaRol, PERMISOS } from '../lib/roles.js';
import EnviarAlertaDialog from '../pages/alertas/EnviarAlertaDialog.jsx';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/inicio', label: 'Inicio', icon: House },
  { to: '/mapa', label: 'Mapa', icon: MapIcon, permiso: PERMISOS.MAPA_VER },
  { to: '/brigadas', label: 'Brigadas', icon: ShieldPlus, permiso: PERMISOS.BRIGADAS_VER },
  { to: '/sedes', label: 'Sedes', icon: Building2, permiso: PERMISOS.SEDES_VER },
  // "Inventario" y no "Equipos", para no confundirlo con "Equipo" (las personas).
  { to: '/equipos', label: 'Inventario', icon: Boxes, permiso: PERMISOS.EQUIPOS_VER },
  { to: '/equipo', label: 'Equipo', icon: Users, permiso: PERMISOS.USUARIOS_GESTIONAR },
];

// En celular caben 5 pestañas: si hay más, las últimas van en "Más".
const MAX_TABS = 5;

export default function AppLayout() {
  const { session, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { usuario, empresa } = session;

  const [alertaDialog, setAlertaDialog] = useState(false);
  const [sedes, setSedes] = useState([]);

  // Cargar sedes para el modal de alerta si tiene permiso de enviar
  useEffect(() => {
    if (can(PERMISOS.ALERTAS_ENVIAR)) {
      api('/api/sedes')
        .then((res) => setSedes(res.sedes ?? []))
        .catch(() => {});
    }
  }, [can]);

  // Mientras tenga contraseña temporal no hay navegación: solo puede cambiarla.
  const items = usuario.debeCambiarContrasena
    ? []
    : NAV.filter((item) => !item.permiso || can(item.permiso));

  const hayMas = items.length > MAX_TABS;
  const itemsTabbar = hayMas ? items.slice(0, MAX_TABS - 1) : items;
  const itemsMas = hayMas ? items.slice(MAX_TABS - 1) : [];
  const [masAbierto, setMasAbierto] = useState(false);

  const opcionesCuenta = [
    !usuario.debeCambiarContrasena && {
      label: 'Cambiar contraseña',
      icon: KeyRound,
      onSelect: () => navigate(RUTA_CAMBIAR_CONTRASENA),
    },
    { label: 'Cerrar sesión', icon: LogOut, onSelect: () => logout() },
  ].filter(Boolean);

  const handleAlertaEnviada = (nuevaAlerta) => {
    toast(`Alerta de ${tipoEmergencia(nuevaAlerta.tipo).etiqueta.toLowerCase()} activada en ${nuevaAlerta.sedeNombre}.`, {
      tone: 'error',
    });
    navigate('/inicio');
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link to="/inicio" className={styles.brand}>
            <Logo />
          </Link>
          <span className={styles.company} title={empresa.razonSocial}>
            {empresa.razonSocial}
          </span>

          {items.length > 1 && (
            <nav className={styles.nav} aria-label="Principal">
              {items.map(({ to, label }) => (
                <NavLink key={to} to={to} className={styles.navLink}>
                  {label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className={styles.account}>
            {can(PERMISOS.ALERTAS_ENVIAR) && !usuario.debeCambiarContrasena && (
              <Button
                variant="danger"
                size="sm"
                icon={Siren}
                onClick={() => setAlertaDialog(true)}
                className={styles.alertaButton}
              >
                Activar alerta
              </Button>
            )}

            <Menu
              label="Tu cuenta"
              trigger={
                <>
                  <span className={styles.who}>
                    <span className={styles.whoName}>{usuario.nombre}</span>
                    <span className={styles.whoRole}>{etiquetaRol(usuario.rol)}</span>
                  </span>
                  <Avatar nombre={usuario.nombre} size={34} />
                </>
              }
              items={opcionesCuenta}
            />
          </div>
        </div>
      </header>

      {!usuario.debeCambiarContrasena && <AlertaGlobal />}

      <main className={styles.main}>
        <Suspense
          fallback={
            <div className={styles.loading} aria-busy="true">
              <span className="spinner" aria-label="Cargando" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {itemsTabbar.length > 1 && (
        <nav className={styles.tabbar} aria-label="Principal">
          {itemsTabbar.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={styles.tab}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          {hayMas && (
            <button
              type="button"
              className={`${styles.tab} ${itemsMas.some((i) => location.pathname.startsWith(i.to)) ? 'active' : ''}`}
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
            >
              <Ellipsis size={20} aria-hidden="true" />
              <span>Más</span>
            </button>
          )}
        </nav>
      )}

      <Dialog open={masAbierto} onClose={() => setMasAbierto(false)} title="Más secciones" size="sm">
        <nav className={styles.moreList} aria-label="Más secciones">
          {itemsMas.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={styles.moreLink} onClick={() => setMasAbierto(false)}>
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </Dialog>

      {alertaDialog && (
        <EnviarAlertaDialog
          open={alertaDialog}
          sedes={sedes}
          onClose={() => setAlertaDialog(false)}
          onEnviada={handleAlertaEnviada}
        />
      )}
    </div>
  );
}
