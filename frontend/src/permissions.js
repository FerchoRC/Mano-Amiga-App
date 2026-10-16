export const ROLES = {
  ADMIN: 'Administrador',
  BRIGADISTA: 'Brigadista',
  EMPLEADO: 'Empleado',
};

export const MODULES = [
  { id: 'map', label: 'Mapa de instalaciones', icon: '📍' },
  { id: 'expirations', label: 'Expiraciones', icon: '🕒' },
  { id: 'inventory', label: 'Inventario', icon: '🧰' },
  { id: 'rules', label: 'Normas y legislación', icon: '📘' },
  { id: 'users', label: 'Usuarios', icon: '👥' },
];

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    modules: ['map', 'expirations', 'inventory', 'rules', 'users'],
    canManageUsers: true,
    canChangeOwnStatus: false,
  },
  [ROLES.BRIGADISTA]: {
    modules: ['map', 'expirations'],
    canManageUsers: false,
    canChangeOwnStatus: false,
  },
  [ROLES.EMPLEADO]: {
    modules: ['map', 'rules'],
    canManageUsers: false,
    canChangeOwnStatus: false,
  },
};

export function getAllowedModules(role) {
  return (ROLE_PERMISSIONS[role]?.modules || []).map((moduleId) =>
    MODULES.find((module) => module.id === moduleId)
  ).filter(Boolean);
}

export function canAccessModule(role, moduleId) {
  return (ROLE_PERMISSIONS[role]?.modules || []).includes(moduleId);
}

export function canManageUsers(role) {
  return Boolean(ROLE_PERMISSIONS[role]?.canManageUsers);
}
