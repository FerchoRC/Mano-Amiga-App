# Backend ManoAmiga

API REST con Express 5 y PostgreSQL.

## Scripts

```bash
npm run dev          # servidor con recarga automática
npm start            # servidor
npm run db:migrate   # aplica src/db/schema.sql (idempotente)
npm run db:seed      # recrea la empresa demo
npm test             # pruebas de integración (requiere la base levantada)
```

## Variables de entorno

Copia `.env.example` a `.env`. Las más importantes:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `APP_URL` | URL del frontend, para los enlaces de invitación y CORS |
| `SESSION_IDLE_MINUTES` | Minutos sin actividad antes de cerrar la sesión (15 por defecto) |
| `RESEND_API_KEY` | Si se define, las invitaciones salen por correo; si no, el administrador copia el enlace |

## Base de datos

```bash
docker compose up -d
```

Host `localhost`, puerto `5432`, usuario, contraseña y base `manoamiga`.

Tablas: `empresa`, `usuario` (el rol es un campo, como en el diagrama entidad-relación),
`invitacion`, `sesion`, `sede`, `plan_emergencia` y `plan_version`.

## Endpoints

Las respuestas de error tienen la forma `{ "error": { "codigo", "mensaje", "campos?" } }`.

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/empresas` | Público | HU-01: registra la empresa y su administrador |
| GET | `/api/empresas/nit-disponible?nit=` | Público | Valida el NIT y si ya está registrado |
| GET | `/api/empresas/actual` | Sesión | Empresa del usuario |
| POST | `/api/auth/login` | Público | HU-02: inicio de sesión |
| POST | `/api/auth/logout` | Sesión | Cierra la sesión |
| GET | `/api/auth/sesion` | Sesión | Usuario, empresa y permisos |
| POST | `/api/auth/actividad` | Sesión | Latido que mantiene viva la sesión |
| PUT | `/api/auth/contrasena` | Sesión | Cambia la propia contraseña (sin la actual si es temporal) |
| GET | `/api/usuarios` | Administrador | HU-03: personas e invitaciones |
| POST | `/api/usuarios` | Administrador | Crea la cuenta con nombre, correo, rol y contraseña |
| POST | `/api/usuarios/:id/contrasena` | Administrador | Restablece la contraseña de otra persona |
| POST | `/api/usuarios/invitaciones` | Administrador | Invita con nombre, correo y rol |
| POST | `/api/usuarios/:id/invitacion` | Administrador | Genera un nuevo enlace de invitación |
| PATCH | `/api/usuarios/:id` | Administrador | Cambia `rol` y/o `activo` |
| DELETE | `/api/usuarios/:id` | Administrador | Cancela una invitación pendiente |
| GET | `/api/invitaciones/:token` | Público | Datos de la invitación |
| POST | `/api/invitaciones/:token/aceptar` | Público | Crea la contraseña e inicia sesión |
| GET | `/api/sedes` | Sesión | HU-04: sedes de la empresa con el estado de su plan |
| GET | `/api/sedes/geocodificar?q=` | Administrador | Busca una dirección en OpenStreetMap (Nominatim) |
| POST | `/api/sedes` | Administrador | Registra una sede con `lat` y `lng` |
| GET | `/api/sedes/:id` | Sesión | Detalle de la sede |
| PUT | `/api/sedes/:id` | Administrador | Edita la sede |
| DELETE | `/api/sedes/:id` | Administrador | Elimina la sede y su plan |
| GET | `/api/sedes/:id/plan` | Sesión | HU-05: plan vigente, borrador e historial (los demás roles solo ven versiones aprobadas) |
| GET | `/api/sedes/:id/plan/versiones/:numero` | Sesión | Una versión del plan |
| POST | `/api/sedes/:id/plan` | Administrador | Crea el plan en borrador, vacío o con `plantilla: true` |
| PUT | `/api/sedes/:id/plan/borrador` | Administrador | Guarda el borrador (puede estar incompleto) |
| POST | `/api/sedes/:id/plan/borrador/aprobar` | Administrador | Aprueba el borrador si está completo |
| POST | `/api/sedes/:id/plan/versiones` | Administrador | Abre una versión nueva a partir de la vigente |
| DELETE | `/api/sedes/:id/plan/borrador` | Administrador | Descarta el borrador |

### Plan de emergencias y versiones

- Cada sede tiene un plan (`plan_emergencia`) con versiones numeradas (`plan_version`).
- Una versión está en `borrador` o `aprobado`. Solo puede haber un borrador abierto por plan.
- Una versión aprobada **no se edita**: queda como evidencia. Para cambiar el plan se crea una versión nueva, que copia la vigente.
- Cada versión registra quién la creó, quién la editó por última vez y quién la aprobó, con sus fechas.
- Para aprobar se exigen al menos un riesgo descrito, un procedimiento con pasos y un punto de encuentro con su ubicación.

## Seguridad

- Contraseñas con `scrypt` y sal aleatoria; los tokens de sesión e invitación se guardan como hash SHA-256.
- Sesiones en el servidor: expiran por inactividad, duran como máximo 12 horas y se cierran al desactivar al usuario.
- El inicio de sesión responde igual (y tarda lo mismo) exista o no el correo.
- Límite de 10 intentos fallidos de inicio de sesión cada 15 minutos por IP.
- Cada consulta de usuarios se filtra por la empresa de quien la hace.
- Si el administrador asigna la contraseña, la persona solo puede cambiarla hasta que elija una propia: el resto de la API responde `CAMBIO_CONTRASENA_REQUERIDO`.
