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

## Estado del proyecto

El MVP son 13 historias de usuario, gestionadas en el tablero de Trello del equipo.

| Historia | Estado | Entrega |
| --- | --- | --- |
| HU-01 Registro de empresa | ✅ Hecha | 16 oct |
| HU-02 Inicio de sesión | ✅ Hecha | 16 oct |
| HU-03 Gestión de usuarios y roles | ✅ Hecha | 16 oct |
| HU-04 Gestión de sedes | ✅ Hecha | 24 oct |
| HU-05 Crear plan de emergencias | ✅ Hecha | 24 oct |
| HU-06 Conformar brigadas | Pendiente | 31 oct |
| HU-07 Mapa de la sede | Pendiente | 31 oct |
| HU-08 Editar puntos del mapa | Pendiente | 7 nov |
| HU-09 Enviar alerta de emergencia | Pendiente | 7 nov |
| HU-10 Confirmar estado en una emergencia | Pendiente | 14 nov |
| HU-11 Inventario de equipos | Pendiente | 14 nov |
| HU-12 Reporte para auditoría | Pendiente | 21 nov |
| HU-13 Panel de cumplimiento | Pendiente | 21 nov |

### Lo que ya funciona

- **Registro de empresa (HU-01):** formulario en dos pasos. El NIT se valida con el dígito de
  verificación de la DIAN y se avisa si ya está registrado. Quien registra la empresa queda como
  Administrador. La pantalla también indica lo que exige la Resolución 0312 de 2019 según el número
  de empleados.
- **Inicio de sesión (HU-02):** con correo y contraseña. Si falla, el mensaje no revela qué dato
  estuvo mal. La sesión se cierra tras 15 minutos de inactividad, con un aviso un minuto antes, y hay
  un límite de intentos fallidos.
- **Usuarios y roles (HU-03):**
  - Crear y asignar: el administrador crea cuentas con contraseña temporal, que la persona cambia en
    su primer ingreso, o invita por enlace. Asigna el rol de Administrador, Brigadista o Empleado.
  - Gestionar: puede cambiar roles, restablecer contraseñas y desactivar a una persona. Al
    desactivarla, sus sesiones se cierran de inmediato.
  - Cambiar la propia contraseña: cualquier usuario puede hacerlo desde su cuenta.
- **Sedes (HU-04):** una empresa puede tener varias sedes, cada una con su ubicación en el mapa.
  Se busca la dirección y luego se ajusta el punto exacto con un clic o arrastrando el marcador.
- **Plan de emergencias (HU-05):**
  - Contenido: un plan por sede con riesgos identificados, procedimientos paso a paso y puntos de
    encuentro.
  - Edición: se trabaja por secciones y se guarda solo. Se puede empezar en blanco o con una
    plantilla sugerida.
  - Estados: el plan pasa de *borrador* a *aprobado*. Queda registrado quién lo creó, lo editó y lo
    aprobó, y cuándo.
  - Versiones: un plan aprobado no se edita, para conservarlo como evidencia. Para cambiarlo se crea
    una versión nueva y la anterior queda en el historial.

---

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Vite, React Router, CSS Modules, Leaflet + OpenStreetMap, lucide-react |
| Backend | Node.js 20+, Express 5, zod (validación), helmet, express-rate-limit |
| Base de datos | PostgreSQL 16 (en Docker para desarrollo) |
| Pruebas | `node:test` + supertest contra PostgreSQL real |
| Correo (opcional) | Resend |

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

## Datos de demostración

`npm run db:seed` crea (o recrea, si ya existe) la empresa **Textiles del Aburrá S.A.S.** Las demás
empresas que hayas registrado no se tocan.

Todas las cuentas usan la contraseña `ManoAmiga2026`:

| Rol | Correo | Notas |
| --- | --- | --- |
| Administrador | `admin@demo.co` | Ve y gestiona todo |
| Brigadista | `brigadista@demo.co` | |
| Empleado | `empleado@demo.co` | |
| Empleado | `marta@demo.co` | Desactivado: no puede entrar |
| Brigadista | `julian@demo.co` | Invitación pendiente: el enlace sale en la consola al correr el seed |

En desarrollo, la pantalla de inicio de sesión tiene botones para llenar las tres primeras.

| Sede | Plan de emergencias |
| --- | --- |
| Planta Itagüí | Aprobado |
| Bodega Sabaneta | En borrador |
| Oficina El Poblado | Sin plan |

Para registrar empresas de prueba usa NITs válidos, por ejemplo `900.123.456-8`, `900.111.222-1`
o `901.555.444-7`. Cada NIT se puede registrar una sola vez.

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

## Variables de entorno

**Backend** (`backend/.env`, a partir de `.env.example`):

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `4000` | Puerto de la API |
| `DATABASE_URL` | base local de Docker | Conexión a PostgreSQL |
| `APP_URL` | `http://localhost:5173` | URL del frontend: enlaces de invitación y CORS |
| `CORS_ORIGINS` | `APP_URL` | Orígenes permitidos, separados por coma |
| `SESSION_IDLE_MINUTES` | `15` | Minutos sin actividad antes de cerrar la sesión |
| `SESSION_MAX_HOURS` | `12` | Duración máxima de una sesión |
| `INVITATION_DAYS` | `7` | Vigencia de los enlaces de invitación |
| `RESEND_API_KEY` | vacío | Si se define, las invitaciones salen por correo |
| `MAIL_FROM` | `ManoAmiga <no-responder@manoamiga.co>` | Remitente de los correos |

**Frontend** (`frontend/.env`, opcional):

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | URL de la API en producción. En desarrollo se deja vacía: Vite redirige `/api` a `localhost:4000` |

`.env` no se sube al repositorio.

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

---

## Limitaciones conocidas

- **Búsqueda de direcciones:** las direcciones colombianas con placa ("Calle 50 # 41-20") se ubican
  de forma aproximada. Por eso el punto se ajusta a mano en el mapa.
- **Plantilla del plan:** es la misma para todas las sedes, sin importar ciudad ni sector. Debe
  validarla un profesional SST.
- **NIT:** solo se aceptan NITs de 9 dígitos (personas jurídicas). Las personas naturales, cuyo NIT
  es la cédula, aún no pueden registrarse.
- **Sedes de los usuarios:** las personas pertenecen a la empresa, no a una sede. Para HU-09
  (alertas a los empleados de una sede) habrá que asignar cada persona a su sede.
- **Mapas en producción:** OpenStreetMap sirve para desarrollo y poco tráfico. Con muchos clientes
  conviene un proveedor de mapas.

---

## Forma de trabajo

- Historias de usuario en el tablero de Trello: *Product Backlog → En progreso → En revisión →
  Terminado*.
- Cada integrante trabaja en su rama y se integra a `main` con pull request.
