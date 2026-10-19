import { HardHat, ShieldCheck, UserRound } from 'lucide-react';

// Coinciden con backend/src/lib/roles.js
export const PERMISOS = {
  USUARIOS_GESTIONAR: 'usuarios:gestionar',
  SEDES_VER: 'sedes:ver',
  SEDES_GESTIONAR: 'sedes:gestionar',
  PLANES_VER: 'planes:ver',
  PLANES_GESTIONAR: 'planes:gestionar',
};

// Descripción de cada rol tal como lo entiende el negocio (documento, sección 07).
export const ROLES = {
  administrador: {
    id: 'administrador',
    etiqueta: 'Administrador',
    plural: 'Administradores',
    icono: ShieldCheck,
    resumen: 'Configura la empresa y gestiona al equipo.',
    capacidades: [
      'Registra sedes, plan de emergencias y brigadas',
      'Invita personas y define su rol',
      'Lleva el inventario y descarga reportes',
    ],
  },
  brigadista: {
    id: 'brigadista',
    etiqueta: 'Brigadista',
    plural: 'Brigadistas',
    icono: HardHat,
    resumen: 'Responde cuando hay una emergencia en su sede.',
    capacidades: [
      'Envía alertas de emergencia a su sede',
      'Ve en tiempo real quién está a salvo y quién falta',
      'Todo lo que puede hacer un empleado',
    ],
  },
  empleado: {
    id: 'empleado',
    etiqueta: 'Empleado',
    plural: 'Empleados',
    icono: UserRound,
    resumen: 'Sabe cómo actuar y avisa cómo está.',
    capacidades: [
      'Consulta el mapa de evacuación de su sede',
      'Recibe las alertas de emergencia',
      'Marca “Estoy a salvo” o “Necesito ayuda”',
    ],
  },
};

export const LISTA_ROLES = Object.values(ROLES);

export const etiquetaRol = (rol) => ROLES[rol]?.etiqueta ?? rol;
