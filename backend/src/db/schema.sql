-- Esquema de ManoAmiga.
-- Es idempotente: se puede ejecutar varias veces sin perder datos.

CREATE TABLE IF NOT EXISTS empresa (
  id_empresa          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nit                 varchar(9)   NOT NULL UNIQUE,
  digito_verificacion smallint     NOT NULL CHECK (digito_verificacion BETWEEN 0 AND 9),
  razon_social        varchar(150) NOT NULL,
  sector              varchar(60)  NOT NULL,
  num_empleados       integer      NOT NULL CHECK (num_empleados > 0),
  creado_en           timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa      uuid         NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
  nombre          varchar(120) NOT NULL,
  correo          varchar(254) NOT NULL,
  -- NULL mientras la persona no haya aceptado su invitación.
  contrasena_hash text,
  rol             varchar(20)  NOT NULL CHECK (rol IN ('administrador', 'brigadista', 'empleado')),
  activo          boolean      NOT NULL DEFAULT true,
  invitado_por    uuid         REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  ultimo_acceso   timestamptz,
  creado_en       timestamptz  NOT NULL DEFAULT now()
);

-- Si el administrador asignó la contraseña, la persona debe cambiarla al entrar.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS usuario_correo_unico ON usuario (lower(correo));
CREATE INDEX IF NOT EXISTS usuario_empresa_idx ON usuario (id_empresa);

-- Una invitación vigente por usuario; reenviarla reemplaza el token.
CREATE TABLE IF NOT EXISTS invitacion (
  id_invitacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario    uuid        NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  token_hash    char(64)    NOT NULL UNIQUE,
  expira_en     timestamptz NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Sesiones del lado del servidor: permiten expirar por inactividad
-- y cerrar de inmediato las sesiones de un usuario desactivado.
CREATE TABLE IF NOT EXISTS sesion (
  id_sesion        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario       uuid        NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  token_hash       char(64)    NOT NULL UNIQUE,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  cerrada_en       timestamptz
);

CREATE INDEX IF NOT EXISTS sesion_usuario_idx ON sesion (id_usuario);

-- HU-04: sedes de la empresa con su ubicación en el mapa.
CREATE TABLE IF NOT EXISTS sede (
  id_sede        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa     uuid         NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
  nombre         varchar(120) NOT NULL,
  direccion      varchar(200) NOT NULL,
  ciudad         varchar(80)  NOT NULL,
  lat            numeric(9, 6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng            numeric(9, 6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  creado_en      timestamptz  NOT NULL DEFAULT now(),
  actualizado_en timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sede_nombre_unico ON sede (id_empresa, lower(nombre));

-- HU-05: un plan de emergencias por sede, con versiones.
-- Una versión aprobada no se modifica (es evidencia ante una auditoría):
-- para cambiar el plan se crea una versión nueva en borrador.
CREATE TABLE IF NOT EXISTS plan_emergencia (
  id_plan    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sede    uuid        NOT NULL UNIQUE REFERENCES sede (id_sede) ON DELETE CASCADE,
  creado_por uuid        REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_version (
  id_version      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_plan         uuid        NOT NULL REFERENCES plan_emergencia (id_plan) ON DELETE CASCADE,
  numero          integer     NOT NULL CHECK (numero > 0),
  estado          varchar(10) NOT NULL CHECK (estado IN ('borrador', 'aprobado')),
  -- { riesgos: [...], procedimientos: [...], puntosEncuentro: [...] }
  contenido       jsonb       NOT NULL,
  creado_por      uuid        REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid        REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  aprobado_por    uuid        REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  aprobado_en     timestamptz,
  UNIQUE (id_plan, numero),
  CHECK ((estado = 'aprobado') = (aprobado_en IS NOT NULL))
);

-- Como máximo un borrador abierto por plan.
CREATE UNIQUE INDEX IF NOT EXISTS plan_un_borrador ON plan_version (id_plan) WHERE estado = 'borrador';

-- Al borrar una empresa, las versiones del plan se alcanzan por dos cascadas
-- (empresa → sede → plan → versión y empresa → usuario → creado_por). Revisar
-- estas llaves al final de la transacción evita que una choque con la otra.
ALTER TABLE plan_emergencia ALTER CONSTRAINT plan_emergencia_id_sede_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE plan_version ALTER CONSTRAINT plan_version_id_plan_fkey DEFERRABLE INITIALLY DEFERRED;
