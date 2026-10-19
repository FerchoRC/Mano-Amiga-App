# ManoAmiga

Plataforma web para la gestión integral de emergencias en organizaciones: sedes, plan de
emergencias, brigadas, mapa de evacuación, inventario de equipos, alertas y reportes de
cumplimiento.

## Estructura

```text
Mano-Amiga-App/
├── frontend/   # SPA en React + Vite (web responsive)
└── backend/    # API en Node.js (Express) + PostgreSQL
```

## Historias implementadas

| Historia | Qué incluye |
| --- | --- |
| HU-01 Registro de empresa | Registro en dos pasos con NIT validado (dígito de verificación DIAN), aviso de NIT duplicado y alta automática como Administrador |
| HU-02 Inicio de sesión | Correo y contraseña con mensaje genérico ante credenciales incorrectas, sesión que expira por inactividad con aviso previo y límite de intentos fallidos |
| HU-03 Usuarios y roles | El administrador crea cuentas con contraseña temporal (o invita por enlace), cambia roles, restablece contraseñas y desactiva con cierre inmediato de sesiones; permisos verificados en cada endpoint |
| HU-04 Gestión de sedes | Varias sedes por empresa, cada una con su ubicación marcada en un mapa (Leaflet + OpenStreetMap), con búsqueda de direcciones |
| HU-05 Plan de emergencias | Editor por secciones (riesgos, procedimientos, puntos de encuentro) con autoguardado, plantilla sugerida, estados borrador y aprobado, versiones y registro de quién lo creó y aprobó |

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para PostgreSQL)

## Puesta en marcha

```bash
# 1. Base de datos
cd backend
docker compose up -d

# 2. Backend
cp .env.example .env
npm install
npm run db:migrate     # crea las tablas
npm run db:seed        # empresa demo con un usuario por rol (opcional)
npm run dev            # http://localhost:4000

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Para ejecutar ambos a la vez desde la raíz: `npm install && npm run dev`.

### Cuentas de demostración

Después de `npm run db:seed`, todas las cuentas usan la contraseña `ManoAmiga2026`:

| Rol | Correo |
| --- | --- |
| Administrador | admin@demo.co |
| Brigadista | brigadista@demo.co |
| Empleado | empleado@demo.co |

En desarrollo, la pantalla de inicio de sesión tiene botones para llenarlas.

## Pruebas

```bash
cd backend
npm test   # pruebas de integración de HU-01, HU-02 y HU-03 contra PostgreSQL
```
