/**
 * Contrato de API mock para Mano Amiga Seguridad.
 *
 * Endpoints esperados del backend real:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - GET /api/users/:companyId
 * - PATCH /api/users/:id
 *
 * Códigos de error estándar:
 * - NIT_DUPLICATED
 * - INVALID_CREDENTIALS
 * - USER_DISABLED
 * - INVALID_NIT
 * - FORBIDDEN
 */

export const httpApi = {
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
  },
  users: {
    list: '/api/users',
    update: '/api/users/:id',
  },
};

export default httpApi;
