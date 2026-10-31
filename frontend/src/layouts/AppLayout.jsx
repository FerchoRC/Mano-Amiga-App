import { Building2, House, KeyRound, LogOut, Users } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import { RUTA_CAMBIAR_CONTRASENA } from '../auth/guards.jsx';
import Avatar from '../components/Avatar.jsx';
import Logo from '../components/Logo.jsx';
import Menu from '../components/Menu.jsx';
import { etiquetaRol, PERMISOS } from '../lib/roles.js';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/inicio', label: 'Inicio', icon: House },
  { to: '/sedes', label: 'Sedes', icon: Building2, permiso: PERMISOS.SEDES_VER },
  { to: '/equipo', label: 'Equipo', icon: Users, permiso: PERMISOS.USUARIOS_GESTIONAR },
];

export default function AppLayout() {
  const { session, logout, can } = useAuth();
  const navigate = useNavigate();
  const { usuario, empresa } = session;
  // Mientras tenga contraseña temporal no hay navegación: solo puede cambiarla.
  const items = usuario.debeCambiarContrasena
    ? []
    : NAV.filter((item) => !item.permiso || can(item.permiso));

  const opcionesCuenta = [
    !usuario.debeCambiarContrasena && {
      label: 'Cambiar contraseña',
      icon: KeyRound,
      onSelect: () => navigate(RUTA_CAMBIAR_CONTRASENA),
    },
    { label: 'Cerrar sesión', icon: LogOut, onSelect: () => logout() },
  ].filter(Boolean);

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

      {items.length > 1 && (
        <nav className={styles.tabbar} aria-label="Principal">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={styles.tab}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
