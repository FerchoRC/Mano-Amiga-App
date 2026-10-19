import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import {
  GuestOnly,
  RequireAuth,
  RequirePermission,
  RUTA_CAMBIAR_CONTRASENA,
} from './auth/guards.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { PERMISOS } from './lib/roles.js';
import AcceptInvitePage from './pages/AcceptInvitePage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
// Las pantallas de sedes usan el mapa (Leaflet): se cargan solo cuando se visitan.
const PlanEditorPage = lazy(() => import('./pages/sedes/PlanEditorPage.jsx'));
const SedeDetailPage = lazy(() => import('./pages/sedes/SedeDetailPage.jsx'));
const SedeFormPage = lazy(() => import('./pages/sedes/SedeFormPage.jsx'));
const SedesPage = lazy(() => import('./pages/sedes/SedesPage.jsx'));
import TeamPage from './pages/team/TeamPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<GuestOnly />}>
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
        </Route>
        <Route path="/invitacion/:token" element={<AcceptInvitePage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<HomePage />} />
          <Route path={RUTA_CAMBIAR_CONTRASENA} element={<ChangePasswordPage />} />
          <Route
            path="/sedes"
            element={
              <RequirePermission permiso={PERMISOS.SEDES_VER}>
                <SedesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sedes/nueva"
            element={
              <RequirePermission permiso={PERMISOS.SEDES_GESTIONAR}>
                <SedeFormPage key="nueva" />
              </RequirePermission>
            }
          />
          <Route
            path="/sedes/:id"
            element={
              <RequirePermission permiso={PERMISOS.SEDES_VER}>
                <SedeDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sedes/:id/editar"
            element={
              <RequirePermission permiso={PERMISOS.SEDES_GESTIONAR}>
                <SedeFormPage key="editar" />
              </RequirePermission>
            }
          />
          <Route
            path="/sedes/:id/plan"
            element={
              <RequirePermission permiso={PERMISOS.PLANES_GESTIONAR}>
                <PlanEditorPage />
              </RequirePermission>
            }
          />
          <Route
            path="/equipo"
            element={
              <RequirePermission permiso={PERMISOS.USUARIOS_GESTIONAR}>
                <TeamPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
