# Backend ManoAmiga

API REST con Express 5 y PostgreSQL.

## Scripts

```bash
npm run dev          # servidor con recarga automática (node --watch; aplica el esquema al arrancar)
npm start            # servidor
npm run db:migrate   # aplica src/db/schema.sql sin arrancar el servidor (idempotente)
npm run db:seed      # recrea la empresa demo (bloqueado en producción)
npm test             # pruebas de integración (requiere la base levantada)
npm run lint         # ESLint
```

## Variables de entorno

Copia `.env.example` a `.env`. Las más importantes:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL. **Obligatoria en producción** |
| `APP_URL` | URL del frontend, para los enlaces de invitación y recuperación y para CORS. **Obligatoria en producción** |
| `DATABASE_SSL` | `verificar` (por defecto en producción), `sin-verificar` (proveedores con certificado propio) o `no` |
| `SESSION_IDLE_MINUTES` | Minutos sin actividad antes de cerrar la sesión (15 por defecto) |
| `RESEND_API_KEY` | Si se define, salen por correo las invitaciones, la recuperación de contraseña y los avisos de alerta |

En producción (`NODE_ENV=production`) el servidor no arranca si falta `DATABASE_URL` o `APP_URL`.

## Arranque y operación

- Al arrancar, el servidor aplica `schema.sql` (con un candado de PostgreSQL, por si arrancan
  dos instancias a la vez). Nadie tiene que acordarse de correr `npm run db:migrate`.
- Cada 6 horas borra sesiones de más de 30 días, enlaces de recuperación usados o vencidos y
  contadores de intentos ya vencidos.
- Ante `SIGTERM` (un despliegue nuevo) deja de aceptar conexiones, termina las peticiones en curso
  y cierra la base. Si se cae una conexión inactiva con la base, la registra y sigue funcionando.

## Base de datos

```bash
docker compose up -d
```

Host `localhost`, puerto `5432`, usuario, contraseña y base `manoamiga`.

Tablas: `empresa`, `usuario` (el rol es un campo, como en el diagrama entidad-relación),
`invitacion`, `sesion`, `recuperacion`, `consentimiento_datos`, `limite_intentos`, `sede`,
`plan_emergencia`, `plan_version`, `brigada`, `brigada_usuario`, `mapa_punto`, `mapa_ruta`,
`alerta`, `alerta_respuesta`, `equipo` y `simulacro`.

El correo es único en toda la plataforma: una persona pertenece a una sola empresa. Es una
decisión del producto; cambiarla implica que el inicio de sesión pida elegir la empresa.

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
| POST | `/api/auth/recuperar` | Público | Envía un enlace para crear una nueva contraseña (responde igual exista o no el correo) |
| GET | `/api/auth/recuperar/:token` | Público | Valida el enlace de recuperación |
| POST | `/api/auth/recuperar/:token` | Público | Guarda la nueva contraseña, cierra las demás sesiones e inicia sesión |
| POST | `/api/auth/consentimiento` | Sesión | Acepta la política de tratamiento de datos vigente (`acepta: true`) |
| GET | `/api/usuarios` | Administrador | HU-03: personas e invitaciones |
| POST | `/api/usuarios` | Administrador | Crea la cuenta con nombre, correo, rol y contraseña |
| POST | `/api/usuarios/:id/contrasena` | Administrador | Restablece la contraseña de otra persona |
| POST | `/api/usuarios/invitaciones` | Administrador | Invita con nombre, correo y rol |
| POST | `/api/usuarios/:id/invitacion` | Administrador | Genera un nuevo enlace de invitación |
| PATCH | `/api/usuarios/:id` | Administrador | Cambia `rol`, `activo` y/o `sedeId` (`null` = todas las sedes) |
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
| GET | `/api/brigadas?sede=` | Sesión | HU-06: brigadas de la empresa (o de una sede) con líder y miembros |
| GET | `/api/brigadas/:id` | Sesión | Una brigada |
| POST | `/api/brigadas` | Administrador | Crea una brigada: `sedeId`, `tipo`, `liderId`, `miembrosIds` |
| PUT | `/api/brigadas/:id` | Administrador | Cambia el líder y los miembros |
| DELETE | `/api/brigadas/:id` | Administrador | Elimina la brigada |
| GET | `/api/sedes/:id/mapa` | Sesión | HU-07: puntos (encuentro, salidas, extintores, botiquines, camillas) y rutas de evacuación |
| POST | `/api/sedes/:id/mapa/puntos` | Administrador | HU-08: agrega un punto (`tipo`, `nombre`, `descripcion?`, `lat`, `lng`) |
| PUT | `/api/sedes/:id/mapa/puntos/:idPunto` | Administrador | Mueve o edita un punto (campos parciales) |
| DELETE | `/api/sedes/:id/mapa/puntos/:idPunto` | Administrador | Elimina un punto |
| POST | `/api/sedes/:id/mapa/rutas` | Administrador | Traza una ruta: `nombre`, `trazado` (`[[lat, lng], …]`, de 2 a 200 puntos), `origen?`, `destino?`, `descripcion?` |
| PUT | `/api/sedes/:id/mapa/rutas/:idRuta` | Administrador | Edita una ruta (campos parciales) |
| DELETE | `/api/sedes/:id/mapa/rutas/:idRuta` | Administrador | Elimina una ruta |
| GET | `/api/alertas/activa` | Sesión | HU-09: alerta activa que le aplica a la persona, con su respuesta |
| POST | `/api/alertas` | Administrador o brigadista | Envía una alerta: `sedeId`, `tipo`, `instrucciones` |
| POST | `/api/alertas/:id/finalizar` | Administrador o brigadista | Da por terminada la emergencia |
| POST | `/api/alertas/:id/respuestas` | Sesión | HU-10: `estado` (`a_salvo` o `necesita_ayuda`) y `mensaje?` |
| GET | `/api/alertas/:id/respuestas` | Administrador o brigadista | Confirmados y pendientes de la alerta |
| GET | `/api/sedes/:id/equipos` | Sesión | HU-11: inventario de la sede |
| POST | `/api/sedes/:id/equipos` | Administrador | Registra un equipo |
| PUT | `/api/equipos/:id` | Administrador | Edita un equipo (campos parciales; `fechaVencimiento: null` la quita) |
| DELETE | `/api/equipos/:id` | Administrador | Elimina un equipo |
| GET | `/api/sedes/:id/simulacros` | Sesión | Simulacros de evacuación registrados en la sede |
| POST | `/api/sedes/:id/simulacros` | Administrador | Registra un simulacro: `fecha`, `participantes`, `tiempoEvacuacion?`, `observaciones?`, `planMejora?` |
| DELETE | `/api/sedes/:id/simulacros/:idSimulacro` | Administrador | Elimina un simulacro |
| GET | `/api/cumplimiento?sedeId=` | Administrador | HU-13: indicadores de cumplimiento (toda la empresa o una sede) |
| GET | `/api/reportes/auditoria?sedeId=&desde=&hasta=&secciones=` | Administrador | HU-12: reporte para auditoría en PDF |

### Brigadas

- Tipos: `primeros_auxilios`, `evacuacion` y `contra_incendios`; una brigada por tipo en cada sede.
- Cada brigada tiene un líder, que debe ser miembro y brigadista activo.
- Un brigadista puede estar en varias brigadas. Solo se asignan brigadistas activos; quien ya era
  miembro puede seguir aunque cambie de rol o se desactive, y la tarjeta lo indica.

### Mapa de evacuación

- Se dibuja sobre el mapa real con latitud y longitud (`mapa_punto` y `mapa_ruta`).
- Las rutas guardan su trazado como `[[lat, lng], …]`; el frontend dibuja flechas en el sentido de evacuación.
- Tipos de punto: `punto_encuentro`, `salida`, `extintor`, `botiquin` y `camilla`.
- Solo el administrador agrega, mueve o elimina puntos y rutas; cada cambio se avisa por tiempo real
  (`mapa:actualizado`) y el mapa se refresca para todos los que lo tienen abierto.
- Las rutas se trazan en el modo edición tocando el mapa desde el origen hasta el punto seguro.

### Alertas de emergencia

- Tipos: `incendio`, `sismo`, `evacuacion`, `inundacion`, `medica`, `amenaza` y `otra`.
- Una sola alerta activa por sede: enviar otra responde `409 ALERTA_ACTIVA`.
- Cada persona tiene una sede (`usuario.id_sede`). La alerta llega a las personas activas de esa
  sede y a las que no tienen sede asignada (por ejemplo, el administrador).
- Solo los destinatarios pueden responder (`403 OTRA_SEDE`) y no se responde una alerta finalizada (`409`).
- Los pendientes son los destinatarios que aún no responden; las invitaciones sin aceptar no cuentan.

### Inventario de equipos

- Tipos: `extintor`, `botiquin`, `camilla` y `otro`; estados: `operativo`, `mantenimiento`, `vencido` y `baja`.
- Cada equipo pertenece a una sede. La fecha de vencimiento o recarga es opcional (`AAAA-MM-DD`).
- El frontend resalta los que vencen en 30 días o menos y los ya vencidos.

### Panel de cumplimiento (HU-13)

Se calcula en el servidor con los datos reales de la empresa (`services/cumplimiento.js`). Cada
indicador trae `estado` (`verde`, `amarillo` o `rojo`), `porcentaje`, `queFalta` y `detalles`
(una línea por sede o por equipo, con `cumple`).

| Indicador | Verde | Amarillo | Rojo |
| --- | --- | --- | --- |
| Plan de emergencias | Todas las sedes con plan aprobado | Alguna aprobada o con borrador | Ninguna |
| Brigadas | Las 3 brigadas en cada sede | Alguna conformada | Ninguna |
| Simulacro anual | Todas con simulacro en los últimos 365 días | Algunas | Ninguna |
| Equipos al día | Ninguno vencido, por vencer ni en mantenimiento | Por vencer (≤ 30 días), en mantenimiento o sede sin equipos | Algún vencido o ningún equipo |
| Mapa de evacuación | Todas con punto de encuentro y salida o ruta | Alguna avanzada | Ninguna |

Los equipos dados de baja no cuentan. El porcentaje global es el promedio de los cinco.

### Reporte para auditoría (HU-12)

PDF A4 generado con `pdfkit` (`services/reporteAuditoria.js`), con las fuentes Inter y Poppins
(licencia OFL) de `assets/fonts/`. Incluye la ficha de la empresa, el resumen de cumplimiento y,
por cada sede, las secciones elegidas (`plan`, `brigadas`, `simulacros`, `inventario`).

- Por defecto, el periodo es el último año hasta hoy; `hasta` no puede ser futura.
- El plan que se muestra es la versión vigente al cierre del periodo, y se listan las aprobadas en él.
- Entran los simulacros con fecha dentro del periodo.
- Las brigadas y el inventario se muestran como están el día en que se genera.

### Tiempo real (`/ws`)

WebSocket en el mismo puerto del API. El token **no** va en la URL:

1. El cliente se conecta a `/ws` y envía `{ "action": "auth", "token": "…" }` (tiene 10 s).
2. El servidor responde `{ "event": "authenticated" }`; con un token inválido cierra con código `4401`.
3. Para entrar a una sala: `{ "action": "join", "room": "…" }`. Salas permitidas:
   `empresa:<su empresa>`, `sede:<sede de su empresa>` y `alerta:<id>` (solo administrador o brigadista).
4. Eventos: `alerta:nueva`, `alerta:finalizada` y `mapa:actualizado` a la empresa (solo con ids);
   `alerta:respuesta` a la sala de la alerta.

La sesión se revisa cada minuto: si se cierra o vence, el servidor envía `sesion:cerrada` y desconecta.

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
- Límite de intentos fallidos de inicio de sesión: 10 cada 15 minutos por IP y correo, y 100 por IP.
  Los contadores viven en PostgreSQL (`limite_intentos`), así que se comparten entre instancias.
- Cada consulta se filtra por la empresa de quien la hace.
- Si el administrador asigna la contraseña, la persona solo puede cambiarla hasta que elija una propia: el resto de la API responde `CAMBIO_CONTRASENA_REQUERIDO`.
- Ley 1581 de 2012: se guarda quién aceptó la política de datos, qué versión y cuándo
  (`consentimiento_datos`). Quien no la ha aceptado solo puede hacerlo o salir: el resto de la API
  responde `CONSENTIMIENTO_REQUERIDO`. Al cambiar `VERSION_POLITICA` todos deben aceptarla de nuevo.
- Los nombres y direcciones no aceptan `<` ni `>`, y el frontend los muestra siempre como texto.
- La recuperación de contraseña usa enlaces de un solo uso que vencen en una hora y se guardan como hash.
- El seed de demostración (contraseñas conocidas) no corre en producción.
