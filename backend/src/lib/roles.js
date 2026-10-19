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
});

const LECTURA = [PERMISOS.EMPRESA_VER, PERMISOS.SEDES_VER, PERMISOS.PLANES_VER];

const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: [
    ...LECTURA,
    PERMISOS.USUARIOS_GESTIONAR,
    PERMISOS.SEDES_GESTIONAR,
    PERMISOS.PLANES_GESTIONAR,
  ],
  [ROLES.BRIGADISTA]: LECTURA,
  [ROLES.EMPLEADO]: LECTURA,
};

export function permisosDe(rol) {
  return PERMISOS_POR_ROL[rol] ?? [];
}

export function tienePermiso(rol, permiso) {
  return permisosDe(rol).includes(permiso);
}
