# ManoAmiga

Plataforma web para la gestión integral de emergencias en organizaciones colombianas: sedes,
plan de emergencias, brigadas, mapa de evacuación, inventario de equipos, alertas y reportes de
cumplimiento, administrados desde un solo lugar.

Es una aplicación web **responsive** que se usa desde el computador o el celular.

| Integrante | Rol |
| --- | --- |
| Luis Fernando Rojas | Project Manager |
| Esteban Barrios | Desarrollador Frontend |
| Samuel | Desarrollador Backend |

---

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Vite, React Router, CSS Modules, Leaflet + OpenStreetMap, lucide-react |
| Backend | Node.js 20+, Express 5, zod (validación), helmet, express-rate-limit |
| Base de datos | PostgreSQL 16 (en Docker para desarrollo) |
| Pruebas | `node:test` + supertest contra PostgreSQL real |

La identidad gráfica (paleta, tipografías Poppins e Inter y logo) sigue el documento del
proyecto, sección 08.

---

## Estructura del repositorio

```text
Mano-Amiga-App/
├── backend/
│   ├── docker-compose.yml     # PostgreSQL para desarrollo
│   ├── src/
│   │   ├── config/            # variables de entorno y conexión a la base
│   │   ├── db/                # schema.sql, migración y datos demo
│   │   ├── lib/               # NIT, contraseñas, roles y permisos, validación, plan
│   │   ├── middleware/        # sesión y permisos, límite de intentos, errores
│   │   ├── routes/            # endpoints: auth, empresas, usuarios, invitaciones, sedes, planes
│   │   ├── services/          # sesiones, invitaciones, correo, sedes, búsqueda de direcciones
│   │   ├── app.js             # aplicación Express
│   │   └── index.js           # arranque del servidor
│   ├── test/                  # pruebas de integración
│   └── README.md              # detalle de la API, endpoints y seguridad
├── frontend/
│   ├── public/                # favicon y logo en SVG
│   ├── src/
│   │   ├── auth/              # sesión, cierre por inactividad y protección de rutas
│   │   ├── components/        # botones, campos, diálogos, menús, mapa…
│   │   ├── layouts/           # pantallas de acceso y de la aplicación
│   │   ├── lib/               # cliente de la API, roles, NIT, formatos, validaciones
│   │   ├── pages/             # inicio, registro, equipo, sedes y plan de emergencias
│   │   └── styles/global.css  # tokens de diseño (colores, tipografía, espaciado)
│   ├── vite.config.js         # en desarrollo redirige /api al backend
│   └── vercel.json            # configuración para desplegar en Vercel
└── package.json               # scripts para levantar ambos a la vez
```

---

## Puesta en marcha

### Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto (para la base de datos)

### 1. Base de datos

```bash
cd backend
docker compose up -d
```

Queda disponible en `localhost:5432`, con usuario, contraseña y base `manoamiga`. Los datos se
guardan en un volumen de Docker y no se pierden al reiniciar.

> Si el puerto 5432 está ocupado por otro PostgreSQL, deténlo o cambia el puerto en
> `docker-compose.yml` y en `DATABASE_URL`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # en Windows (cmd): copy .env.example .env
npm install
npm run db:migrate        # crea o actualiza las tablas
npm run db:seed           # empresa demo con usuarios, sedes y planes (opcional)
npm run dev               # http://localhost:4000
```

### 3. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Abre **http://localhost:5173**.

### Ambos a la vez

Después de instalar las dependencias de `backend/` y `frontend/`, desde la raíz:

```bash
npm install
npm run dev
```

---

## Scripts

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| `backend/` | `npm run dev` | API con recarga automática |
| `backend/` | `npm start` | API sin recarga |
| `backend/` | `npm run db:migrate` | Aplica `src/db/schema.sql`; se puede correr varias veces |
| `backend/` | `npm run db:seed` | Recrea la empresa demo |
| `backend/` | `npm test` | Pruebas de integración (requiere la base levantada) |
| `frontend/` | `npm run dev` | Servidor de desarrollo de Vite |
| `frontend/` | `npm run build` | Compila para producción en `dist/` |
| raíz | `npm run dev` | Backend y frontend a la vez |

---

## Roles y permisos

Los permisos se verifican en **cada endpoint** del backend. El frontend solo muestra lo que el rol
puede usar.

| Puede… | Administrador | Brigadista | Empleado |
| --- | :---: | :---: | :---: |
| Ver la empresa, sus sedes y los planes aprobados | ✅ | ✅ | ✅ |
| Gestionar usuarios y roles | ✅ | | |
| Registrar y editar sedes | ✅ | | |
| Crear, editar y aprobar planes de emergencia | ✅ | | |

Por ahora brigadista y empleado ven lo mismo. Se diferenciarán con HU-06 (brigadas), HU-09
(enviar alertas) y HU-10 (ver quién está a salvo).

---

## Cómo está construido

- **Sesiones:** se guardan en la base de datos, no en el navegador. Por eso pueden vencer por
  inactividad y cerrarse al instante cuando se desactiva a alguien. El token viaja como
  `Authorization: Bearer` y en la base solo se guarda su hash.
- **Contraseñas:** cifradas con `scrypt`. Si el administrador asigna una contraseña temporal, la
  persona solo puede cambiarla hasta que elija una propia.
- **Empresas separadas:** cada consulta se filtra por la empresa de quien la hace, así que nadie ve
  datos de otra empresa.
- **Errores de la API:** siempre con la forma `{ "error": { "codigo", "mensaje", "campos?" } }`.
  `codigo` es estable para el frontend y `mensaje` se muestra al usuario.
- **Plan de emergencias:** cada sede tiene un plan (`plan_emergencia`) con versiones numeradas
  (`plan_version`). Cada versión está en `borrador` o `aprobado`, y una versión aprobada no se
  modifica.
- **Mapas:** Leaflet con mapas de OpenStreetMap. La búsqueda de direcciones (Nominatim) pasa por
  el backend, en fila y con caché, para respetar su política de uso.

La lista completa de endpoints, tablas y medidas de seguridad está en
[`backend/README.md`](backend/README.md).

---

## Pruebas

```bash
cd backend
npm test
```

Son 32 pruebas de integración contra PostgreSQL real, una o más por cada criterio de aceptación de
HU-01 a HU-05. Cada prueba crea sus propios datos y los borra al terminar.

---

## Despliegue (planeado)

Según el documento del proyecto, sección 06:

| Parte | Servicio |
| --- | --- |
| Frontend | Vercel (`frontend/vercel.json` ya redirige todas las rutas a la aplicación) |
| Backend | Render |
| Base de datos | PostgreSQL en Render; aplicar el esquema con `npm run db:migrate` |
| Correos | Resend |

En producción hay que definir `NODE_ENV=production`, `APP_URL` con la URL pública del frontend y
`VITE_API_URL` con la de la API.
