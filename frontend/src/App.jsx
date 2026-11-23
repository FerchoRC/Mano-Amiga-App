import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import {
  GuestOnly,
  RequireAuth,
  RequirePermission,
  RUTA_CAMBIAR_CONTRASENA,
  RUTA_CONSENTIMIENTO,
} from './auth/guards.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { PERMISOS } from './lib/roles.js';
import AcceptInvitePage from './pages/AcceptInvitePage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import ConsentimientoPage from './pages/legal/ConsentimientoPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import NuevaContrasenaPage from './pages/NuevaContrasenaPage.jsx';
import RecuperarPage from './pages/RecuperarPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TeamPage from './pages/team/TeamPage.jsx';

// Las pantallas pesadas (mapas, editor del plan, reportes) se cargan solo cuando se visitan.
const BrigadasPage = lazy(() => import('./pages/brigadas/BrigadasPage.jsx'));
const CumplimientoPage = lazy(() => import('./pages/cumplimiento/CumplimientoPage.jsx'));
const EquiposPage = lazy(() => import('./pages/equipos/EquiposPage.jsx'));
const MapaPage = lazy(() => import('./pages/mapa/MapaPage.jsx'));
const PlanEditorPage = lazy(() => import('./pages/sedes/PlanEditorPage.jsx'));
const ReportesPage = lazy(() => import('./pages/reportes/ReportesPage.jsx'));
const SedeDetailPage = lazy(() => import('./pages/sedes/SedeDetailPage.jsx'));
const SedeFormPage = lazy(() => import('./pages/sedes/SedeFormPage.jsx'));
const SedesPage = lazy(() => import('./pages/sedes/SedesPage.jsx'));
const PoliticaDatosPage = lazy(() => import('./pages/legal/PoliticaDatosPage.jsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<GuestOnly />}>
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/recuperar" element={<RecuperarPage />} />
        </Route>
        <Route path="/invitacion/:token" element={<AcceptInvitePage />} />
        <Route path="/recuperar/:token" element={<NuevaContrasenaPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<HomePage />} />
          <Route path={RUTA_CAMBIAR_CONTRASENA} element={<ChangePasswordPage />} />
          <Route path={RUTA_CONSENTIMIENTO} element={<ConsentimientoPage />} />
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
            path="/brigadas"
            element={
              <RequirePermission permiso={PERMISOS.BRIGADAS_VER}>
                <BrigadasPage />
              </RequirePermission>
            }
          />
          <Route
            path="/mapa"
            element={
              <RequirePermission permiso={PERMISOS.MAPA_VER}>
                <MapaPage />
              </RequirePermission>
            }
          />
          <Route
            path="/equipos"
            element={
              <RequirePermission permiso={PERMISOS.EQUIPOS_VER}>
                <EquiposPage />
              </RequirePermission>
            }
          />
          <Route
            path="/cumplimiento"
            element={
              <RequirePermission permiso={PERMISOS.CUMPLIMIENTO_VER}>
                <CumplimientoPage />
              </RequirePermission>
            }
          />
          <Route
            path="/reportes"
            element={
              <RequirePermission permiso={PERMISOS.REPORTES_VER}>
                <ReportesPage />
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

      <Route
        path="/politica-de-datos"
        element={
          <Suspense fallback={null}>
            <PoliticaDatosPage />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
