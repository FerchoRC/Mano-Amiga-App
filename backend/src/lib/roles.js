// HU-03: cada rol solo ve y hace lo que le corresponde.
// Los permisos se verifican en cada endpoint y se envían al frontend
// para que muestre únicamente lo que el usuario puede usar.

export const ROLES = Object.freeze({
  ADMINISTRADOR: 'administrador',
  BRIGADISTA: 'brigadista',
  EMPLEADO: 'empleado',
});

export const LISTA_ROLES = Object.values(ROLES);

export const PERMISOS = Object.freeze({
  EMPRESA_VER: 'empresa:ver',
  USUARIOS_GESTIONAR: 'usuarios:gestionar',
  SEDES_VER: 'sedes:ver',
  SEDES_GESTIONAR: 'sedes:gestionar',
  // Ver solo planes aprobados; gestionar incluye borradores y aprobación.
  PLANES_VER: 'planes:ver',
  PLANES_GESTIONAR: 'planes:gestionar',
  BRIGADAS_VER: 'brigadas:ver',
  BRIGADAS_GESTIONAR: 'brigadas:gestionar',
  MAPA_VER: 'mapa:ver',
  MAPA_GESTIONAR: 'mapa:gestionar',
  ALERTAS_VER: 'alertas:ver',
  ALERTAS_ENVIAR: 'alertas:enviar',
  EQUIPOS_VER: 'equipos:ver',
  EQUIPOS_GESTIONAR: 'equipos:gestionar',
});

const LECTURA = [
  PERMISOS.EMPRESA_VER,
  PERMISOS.SEDES_VER,
  PERMISOS.PLANES_VER,
  PERMISOS.BRIGADAS_VER,
  PERMISOS.MAPA_VER,
  PERMISOS.ALERTAS_VER,
  PERMISOS.EQUIPOS_VER,
];

const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: [
    ...LECTURA,
    PERMISOS.USUARIOS_GESTIONAR,
    PERMISOS.SEDES_GESTIONAR,
    PERMISOS.PLANES_GESTIONAR,
    PERMISOS.BRIGADAS_GESTIONAR,
    PERMISOS.MAPA_GESTIONAR,
    PERMISOS.ALERTAS_ENVIAR,
    PERMISOS.EQUIPOS_GESTIONAR,
  ],
  [ROLES.BRIGADISTA]: [
    ...LECTURA,
    PERMISOS.ALERTAS_ENVIAR,
  ],
  [ROLES.EMPLEADO]: LECTURA,
};

export function permisosDe(rol) {
  return PERMISOS_POR_ROL[rol] ?? [];
}

export function tienePermiso(rol, permiso) {
  return permisosDe(rol).includes(permiso);
}
