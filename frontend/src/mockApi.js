import { ROLES } from './permissions.js';

const companies = [
  {
    id: 'company-demo',
    nit: '9001234566',
    businessName: 'Constructora Demo S.A.S.',
    sector: 'Construcción',
    employees: 180,
  },
];

const users = [
  {
    id: 'user-admin',
    companyId: 'company-demo',
    name: 'Ana Torres',
    email: 'admin@demo.co',
    password: 'Demo1234',
    role: ROLES.ADMIN,
    active: true,
    createdAt: '2026-01-10',
  },
  {
    id: 'user-brigada',
    companyId: 'company-demo',
    name: 'Luis Ramírez',
    email: 'brigada@demo.co',
    password: 'Demo1234',
    role: ROLES.BRIGADISTA,
    active: true,
    createdAt: '2026-02-16',
  },
  {
    id: 'user-empleado',
    companyId: 'company-demo',
    name: 'Sofía Gómez',
    email: 'empleado@demo.co',
    password: 'Demo1234',
    role: ROLES.EMPLEADO,
    active: true,
    createdAt: '2026-03-03',
  },
];

export function getCompanyById(companyId) {
  return companies.find((company) => company.id === companyId) || null;
}

export function getCompanyUsers(companyId) {
  return users
    .filter((user) => user.companyId === companyId)
    .map((user) => ({ ...user }));
}

export function loginUser(email, password) {
  const foundUser = users.find(
    (user) => user.email.toLowerCase() === String(email).trim().toLowerCase()
  );

  if (!foundUser) {
    return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' };
  }

  if (!foundUser.active || foundUser.password !== password) {
    return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' };
  }

  const company = getCompanyById(foundUser.companyId);

  return {
    ok: true,
    user: { ...foundUser, companyName: company?.businessName || 'Empresa' },
    company,
  };
}

export function registerCompany({ nit, businessName, sector, employees, adminName, adminEmail, adminPassword }) {
  const normalizedNit = String(nit).replace(/[^0-9]/g, '');
  const exists = companies.some((company) => company.nit === normalizedNit);

  if (exists) {
    return { ok: false, code: 'NIT_DUPLICATED', message: 'Este NIT ya está registrado. Solicita una invitación al administrador de la empresa.' };
  }

  const finalNit = normalizedNit;
  if (!/^\d{10}$/.test(finalNit) || !/\d$/.test(finalNit)) {
    return { ok: false, code: 'INVALID_NIT', message: 'El NIT no es válido.' };
  }

  const companyId = `company-${Date.now()}`;
  const company = {
    id: companyId,
    nit: finalNit,
    businessName,
    sector,
    employees: Number(employees),
  };

  const adminUser = {
    id: `user-${Date.now()}`,
    companyId,
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: ROLES.ADMIN,
    active: true,
    createdAt: new Date().toISOString(),
  };

  companies.push(company);
  users.push(adminUser);

  return {
    ok: true,
    user: { ...adminUser, companyName: company.businessName },
    company,
  };
}

export function updateUserAccess({ userId, role, active, currentUserId }) {
  const userToUpdate = users.find((user) => user.id === userId);

  if (!userToUpdate) {
    return { ok: false, code: 'NOT_FOUND', message: 'Usuario no encontrado.' };
  }

  if (currentUserId === userId) {
    return { ok: false, code: 'FORBIDDEN', message: 'No puedes cambiar tu propio rol o estado.' };
  }

  userToUpdate.role = role;
  userToUpdate.active = active;

  if (!active) {
    userToUpdate.sessionValid = false;
  }

  return { ok: true, user: { ...userToUpdate } };
}

export function createInvitation({ companyId, email, role }) {
  const temporaryPassword = 'Invitacion2024!';
  const invitedUser = {
    id: `user-${Date.now()}`,
    companyId,
    name: email.split('@')[0],
    email,
    password: temporaryPassword,
    role,
    active: true,
    createdAt: new Date().toISOString(),
  };

  users.push(invitedUser);

  return { ok: true, temporaryPassword, user: invitedUser };
}

export function getDemoSession() {
  const user = users.find((item) => item.email === 'admin@demo.co');
  const company = getCompanyById(user?.companyId);

  return user ? { user: { ...user, companyName: company?.businessName }, company } : null;
}
