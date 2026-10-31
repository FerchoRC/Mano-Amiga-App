// Pruebas de integración de HU-01, HU-02 y HU-03 contra PostgreSQL real.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  api,
  auth,
  CONTRASENA,
  correoAleatorio,
  invitarYAceptar,
  nitAleatorio,
  pool,
  registrarEmpresa,
  usarBaseDePruebas,
} from './helpers.js';

const { hashToken } = await import('../src/lib/tokens.js');

usarBaseDePruebas();

describe('HU-01 · Registro de empresa', () => {
  test('registra la empresa y deja a quien la registra como Administrador', async () => {
    const { res, token } = await registrarEmpresa();

    assert.equal(res.status, 201);
    assert.equal(res.body.usuario.rol, 'administrador');
    assert.ok(res.body.permisos.includes('usuarios:gestionar'));

    const sesion = await api().get('/api/auth/sesion').set(...auth(token));
    assert.equal(sesion.status, 200);
    assert.equal(sesion.body.empresa.razonSocial, 'Prueba S.A.S.');
  });

  test('rechaza un NIT con dígito de verificación incorrecto', async () => {
    const nit = nitAleatorio();
    const dvMalo = (Number(nit.completo.at(-1)) + 1) % 10;
    const { res } = await registrarEmpresa({
      empresa: { nit: `${nit.base}-${dvMalo}`, razonSocial: 'X S.A.S.', sector: 'Comercio', numEmpleados: 5 },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.campos['empresa.nit']);
  });

  test('muestra un error si el NIT ya está registrado', async () => {
    const primera = await registrarEmpresa();
    const disponible = await api().get('/api/empresas/nit-disponible').query({ nit: primera.nit.completo });
    assert.deepEqual(disponible.body, { valido: true, disponible: false });

    const repetida = await registrarEmpresa({
      empresa: { nit: primera.nit.completo, razonSocial: 'Otra S.A.S.', sector: 'Salud', numEmpleados: 12 },
    });
    assert.equal(repetida.res.status, 409);
    assert.equal(repetida.res.body.error.codigo, 'NIT_DUPLICADO');
  });

  test('exige aceptar el tratamiento de datos', async () => {
    const { res } = await registrarEmpresa({ aceptaTratamientoDatos: false });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.campos.aceptaTratamientoDatos);
  });
});

describe('HU-02 · Inicio de sesión', () => {
  test('entra con correo y contraseña correctos', async () => {
    const { correo } = await registrarEmpresa();
    const res = await api().post('/api/auth/login').send({ correo: correo.toUpperCase(), contrasena: CONTRASENA });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.usuario.correo, correo);
  });

  test('responde igual si falla el correo o la contraseña', async () => {
    const { correo } = await registrarEmpresa();
    const malaContrasena = await api().post('/api/auth/login').send({ correo, contrasena: 'Otra2026x' });
    const correoInexistente = await api()
      .post('/api/auth/login')
      .send({ correo: 'nadie@prueba.co', contrasena: CONTRASENA });

    assert.equal(malaContrasena.status, 401);
    assert.equal(correoInexistente.status, 401);
    assert.deepEqual(malaContrasena.body, correoInexistente.body);
  });

  test('la sesión expira tras el tiempo de inactividad', async () => {
    const { token } = await registrarEmpresa();
    await pool.query(
      `UPDATE sesion SET ultima_actividad = now() - interval '1 day' WHERE token_hash = $1`,
      [hashToken(token)]
    );

    const res = await api().get('/api/auth/sesion').set(...auth(token));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.codigo, 'SESION_EXPIRADA');
  });

  test('cerrar sesión invalida el token', async () => {
    const { token } = await registrarEmpresa();
    assert.equal((await api().post('/api/auth/logout').set(...auth(token))).status, 204);
    assert.equal((await api().get('/api/auth/sesion').set(...auth(token))).status, 401);
  });
});

describe('HU-03 · Gestión de usuarios y roles', () => {
  test('el administrador invita y la persona entra con el rol asignado', async () => {
    const { token } = await registrarEmpresa();
    const brigadista = await invitarYAceptar(token, 'brigadista');

    const sesion = await api().get('/api/auth/sesion').set(...auth(brigadista.token));
    assert.equal(sesion.body.usuario.rol, 'brigadista');
    assert.ok(!sesion.body.permisos.includes('usuarios:gestionar'));
  });

  test('cada rol solo accede a lo que le corresponde', async () => {
    const { token } = await registrarEmpresa();
    const brigadista = await invitarYAceptar(token, 'brigadista');
    const empleado = await invitarYAceptar(token, 'empleado');

    for (const otro of [brigadista, empleado]) {
      const lista = await api().get('/api/usuarios').set(...auth(otro.token));
      assert.equal(lista.status, 403);
      const invitar = await api()
        .post('/api/usuarios/invitaciones')
        .set(...auth(otro.token))
        .send({ nombre: 'Intruso', correo: correoAleatorio('x'), rol: 'administrador' });
      assert.equal(invitar.status, 403);
    }
    assert.equal((await api().get('/api/usuarios').set(...auth(token))).status, 200);
  });

  test('el administrador cambia el rol de un usuario', async () => {
    const { token } = await registrarEmpresa();
    const empleado = await invitarYAceptar(token, 'empleado');

    const res = await api().patch(`/api/usuarios/${empleado.id}`).set(...auth(token)).send({ rol: 'brigadista' });
    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.rol, 'brigadista');
  });

  test('desactivar cierra las sesiones y bloquea el inicio de sesión', async () => {
    const { token } = await registrarEmpresa();
    const empleado = await invitarYAceptar(token, 'empleado');

    const res = await api().patch(`/api/usuarios/${empleado.id}`).set(...auth(token)).send({ activo: false });
    assert.equal(res.body.usuario.estado, 'inactivo');

    assert.equal((await api().get('/api/auth/sesion').set(...auth(empleado.token))).status, 401);
    const login = await api().post('/api/auth/login').send({ correo: empleado.correo, contrasena: CONTRASENA });
    assert.equal(login.status, 403);
    assert.equal(login.body.error.codigo, 'USUARIO_INACTIVO');
  });

  test('el administrador no puede cambiar su propio rol ni desactivarse', async () => {
    const { res, token } = await registrarEmpresa();
    const propio = await api()
      .patch(`/api/usuarios/${res.body.usuario.id}`)
      .set(...auth(token))
      .send({ rol: 'empleado' });
    assert.equal(propio.status, 403);
    assert.equal(propio.body.error.codigo, 'ACCION_SOBRE_SI_MISMO');
  });

  test('no se pueden tocar usuarios de otra empresa', async () => {
    const empresaA = await registrarEmpresa();
    const empresaB = await registrarEmpresa();
    const deB = await invitarYAceptar(empresaB.token, 'empleado');

    const res = await api().patch(`/api/usuarios/${deB.id}`).set(...auth(empresaA.token)).send({ activo: false });
    assert.equal(res.status, 404);
  });

  test('el administrador crea un usuario con contraseña y debe cambiarla al entrar', async () => {
    const { token } = await registrarEmpresa();
    const correo = correoAleatorio('directo');
    const creado = await api()
      .post('/api/usuarios')
      .set(...auth(token))
      .send({ nombre: 'Persona Directa', correo, rol: 'empleado', contrasena: 'Temporal2026' });
    assert.equal(creado.status, 201);
    assert.equal(creado.body.usuario.estado, 'activo');
    assert.equal(creado.body.usuario.contrasenaTemporal, true);

    const login = await api().post('/api/auth/login').send({ correo, contrasena: 'Temporal2026' });
    assert.equal(login.status, 200);
    assert.equal(login.body.usuario.debeCambiarContrasena, true);

    // Con contraseña temporal solo puede cambiarla (y ver su sesión).
    const bloqueado = await api().get('/api/empresas/actual').set(...auth(login.body.token));
    assert.equal(bloqueado.status, 403);
    assert.equal(bloqueado.body.error.codigo, 'CAMBIO_CONTRASENA_REQUERIDO');

    const cambio = await api()
      .put('/api/auth/contrasena')
      .set(...auth(login.body.token))
      .send({ contrasenaNueva: 'Propia2026' });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.body.usuario.debeCambiarContrasena, false);
    assert.equal((await api().get('/api/empresas/actual').set(...auth(login.body.token))).status, 200);
  });

  test('cambiar la propia contraseña exige la actual si no es temporal', async () => {
    const { token } = await registrarEmpresa();
    const sinActual = await api()
      .put('/api/auth/contrasena')
      .set(...auth(token))
      .send({ contrasenaNueva: 'Nueva2026x' });
    assert.equal(sinActual.status, 400);
    assert.equal(sinActual.body.error.codigo, 'CONTRASENA_ACTUAL_INCORRECTA');

    const conActual = await api()
      .put('/api/auth/contrasena')
      .set(...auth(token))
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'Nueva2026x' });
    assert.equal(conActual.status, 200);
  });

  test('restablecer la contraseña cierra las sesiones de la persona', async () => {
    const { token } = await registrarEmpresa();
    const empleado = await invitarYAceptar(token, 'empleado');

    const res = await api()
      .post(`/api/usuarios/${empleado.id}/contrasena`)
      .set(...auth(token))
      .send({ contrasena: 'Reinicio2026' });
    assert.equal(res.status, 200);
    assert.equal((await api().get('/api/auth/sesion').set(...auth(empleado.token))).status, 401);

    const login = await api().post('/api/auth/login').send({ correo: empleado.correo, contrasena: 'Reinicio2026' });
    assert.equal(login.status, 200);
  });

  test('solo el administrador puede crear usuarios', async () => {
    const { token } = await registrarEmpresa();
    const brigadista = await invitarYAceptar(token, 'brigadista');
    const res = await api()
      .post('/api/usuarios')
      .set(...auth(brigadista.token))
      .send({ nombre: 'Intruso', correo: correoAleatorio('x'), rol: 'administrador', contrasena: 'Intruso2026' });
    assert.equal(res.status, 403);
  });

  test('una invitación pendiente se puede reenviar y cancelar', async () => {
    const { token } = await registrarEmpresa();
    const invitacion = await api()
      .post('/api/usuarios/invitaciones')
      .set(...auth(token))
      .send({ nombre: 'Pendiente', correo: correoAleatorio('pendiente'), rol: 'empleado' });
    const id = invitacion.body.usuario.id;
    const enlaceViejo = invitacion.body.enlace.split('/invitacion/')[1];

    const reenvio = await api().post(`/api/usuarios/${id}/invitacion`).set(...auth(token));
    assert.equal(reenvio.status, 200);
    assert.equal((await api().get(`/api/invitaciones/${enlaceViejo}`)).status, 404);

    assert.equal((await api().delete(`/api/usuarios/${id}`).set(...auth(token))).status, 204);
  });
});
