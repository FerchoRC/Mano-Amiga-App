// Utilidades compartidas por las pruebas de integración.
// Requieren la base levantada (docker compose up -d).
import assert from 'node:assert/strict';
import { after, before } from 'node:test';

import request from 'supertest';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
export const { pool } = await import('../src/config/db.js');
const { migrate } = await import('../src/db/migrate.js');
const { calcularDigitoVerificacion } = await import('../src/lib/nit.js');

const app = createApp();
export const api = () => request(app);
export const CONTRASENA = 'Segura2026';
export const auth = (token) => ['Authorization', `Bearer ${token}`];

const nitsCreados = [];

export function nitAleatorio() {
  const base = String(900_000_000 + Math.floor(Math.random() * 99_999_999));
  return { base, completo: `${base}-${calcularDigitoVerificacion(base)}` };
}

export const correoAleatorio = (prefijo) =>
  `${prefijo}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@prueba.co`;

export async function registrarEmpresa(cambios = {}) {
  const nit = nitAleatorio();
  nitsCreados.push(nit.base);
  const correo = correoAleatorio('admin');
  const res = await api()
    .post('/api/empresas')
    .send({
      empresa: { nit: nit.completo, razonSocial: 'Prueba S.A.S.', sector: 'Comercio', numEmpleados: 40 },
      administrador: { nombre: 'Admin Prueba', correo, contrasena: CONTRASENA },
      aceptaTratamientoDatos: true,
      ...cambios,
    });
  return { res, nit, correo, token: res.body.token };
}

export async function invitarYAceptar(tokenAdmin, rol) {
  const correo = correoAleatorio(rol);
  const invitacion = await api()
    .post('/api/usuarios/invitaciones')
    .set(...auth(tokenAdmin))
    .send({ nombre: `Persona ${rol}`, correo, rol });
  assert.equal(invitacion.status, 201);

  const tokenInvitacion = invitacion.body.enlace.split('/invitacion/')[1];
  const aceptada = await api()
    .post(`/api/invitaciones/${tokenInvitacion}/aceptar`)
    .send({ nombre: `Persona ${rol}`, contrasena: CONTRASENA });
  assert.equal(aceptada.status, 201);

  return { id: invitacion.body.usuario.id, correo, token: aceptada.body.token };
}

// Prepara la base y, al terminar el archivo, borra las empresas creadas.
export function usarBaseDePruebas() {
  before(async () => {
    await migrate();
  });
  after(async () => {
    await pool.query('DELETE FROM empresa WHERE nit = ANY($1)', [nitsCreados]);
    await pool.end();
  });
}
