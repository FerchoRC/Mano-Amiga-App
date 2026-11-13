// Pruebas de integración de HU-08 (editar mapa), HU-09 (alertas), HU-10 (confirmar
// estado), HU-11 (inventario) y de la seguridad del tiempo real (WebSocket).
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';

import WebSocket from 'ws';

import { api, auth, invitarYAceptar, registrarEmpresa, usarBaseDePruebas } from './helpers.js';

const { createApp } = await import('../src/app.js');
const { initRealtime, closeRealtime } = await import('../src/services/realtime.js');

// Servidor real para el WebSocket. Se cierra antes de que helpers.js cierre la base.
let servidor;
let puerto;
before(async () => {
  servidor = http.createServer(createApp());
  initRealtime(servidor);
  await new Promise((resolve) => servidor.listen(0, resolve));
  puerto = servidor.address().port;
});
after(async () => {
  closeRealtime();
  await new Promise((resolve) => servidor.close(resolve));
});
usarBaseDePruebas();

const crearSede = (token, nombre = 'Planta Norte') =>
  api()
    .post('/api/sedes')
    .set(...auth(token))
    .send({ nombre, direccion: 'Calle 50 # 41-20', ciudad: 'Itagüí', lat: 6.1752, lng: -75.6052 })
    .then((r) => r.body.sede.id);

const asignarSede = (tokenAdmin, idUsuario, sedeId) =>
  api().patch(`/api/usuarios/${idUsuario}`).set(...auth(tokenAdmin)).send({ sedeId });

// Empresa con dos sedes, un brigadista y un empleado en la Planta, y un empleado en la Bodega.
async function escenario() {
  const empresa = await registrarEmpresa();
  const planta = await crearSede(empresa.token, 'Planta');
  const bodega = await crearSede(empresa.token, 'Bodega');
  const brigadista = await invitarYAceptar(empresa.token, 'brigadista');
  const empleado = await invitarYAceptar(empresa.token, 'empleado');
  const deBodega = await invitarYAceptar(empresa.token, 'empleado');
  await asignarSede(empresa.token, brigadista.id, planta);
  await asignarSede(empresa.token, empleado.id, planta);
  await asignarSede(empresa.token, deBodega.id, bodega);
  return { ...empresa, planta, bodega, brigadista, empleado, deBodega };
}

const enviarAlerta = (token, sedeId, datos = {}) =>
  api()
    .post('/api/alertas')
    .set(...auth(token))
    .send({ sedeId, tipo: 'incendio', instrucciones: 'Evacúa por la ruta señalizada.', ...datos });

// Cliente WebSocket que guarda los eventos recibidos.
async function conectar(token) {
  const ws = new WebSocket(`ws://localhost:${puerto}/ws`);
  ws.eventos = [];
  ws.on('message', (m) => ws.eventos.push(JSON.parse(m.toString())));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  if (token) {
    ws.send(JSON.stringify({ action: 'auth', token }));
    await esperarEvento(ws, 'authenticated');
  }
  return ws;
}

async function esperarEvento(ws, nombre, timeout = 2000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    const encontrado = ws.eventos.find((e) => e.event === nombre);
    if (encontrado) return encontrado;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe('HU-08 · Editar puntos del mapa', () => {
  test('el administrador agrega, mueve y elimina puntos (incluidas salidas)', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token);
    const url = `/api/sedes/${sede}/mapa/puntos`;

    const creado = await api()
      .post(url)
      .set(...auth(token))
      .send({ tipo: 'salida', nombre: 'Salida norte', lat: 6.1753, lng: -75.605 });
    assert.equal(creado.status, 201);
    const id = creado.body.punto.id;

    const movido = await api().put(`${url}/${id}`).set(...auth(token)).send({ lat: 6.1755, lng: -75.6049 });
    assert.equal(movido.status, 200);
    assert.deepEqual([movido.body.punto.lat, movido.body.punto.lng, movido.body.punto.nombre], [6.1755, -75.6049, 'Salida norte']);

    assert.equal((await api().delete(`${url}/${id}`).set(...auth(token))).status, 204);
    const mapa = await api().get(`/api/sedes/${sede}/mapa`).set(...auth(token));
    assert.equal(mapa.body.puntos.length, 0);
  });

  test('solo el administrador puede editar el mapa', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token);
    const brigadista = await invitarYAceptar(token, 'brigadista');
    const res = await api()
      .post(`/api/sedes/${sede}/mapa/puntos`)
      .set(...auth(brigadista.token))
      .send({ tipo: 'extintor', nombre: 'EXT', lat: 6.17, lng: -75.6 });
    assert.equal(res.status, 403);
  });

  test('valida los datos del punto y no toca mapas de otra empresa', async () => {
    const empresaA = await registrarEmpresa();
    const empresaB = await registrarEmpresa();
    const sedeB = await crearSede(empresaB.token);
    const sedeA = await crearSede(empresaA.token);

    const invalido = await api()
      .post(`/api/sedes/${sedeA}/mapa/puntos`)
      .set(...auth(empresaA.token))
      .send({ tipo: 'ascensor', nombre: 'X', lat: 'norte', lng: -75.6 });
    assert.equal(invalido.status, 400);
    assert.ok(invalido.body.error.campos.tipo && invalido.body.error.campos.lat);

    const ajeno = await api()
      .post(`/api/sedes/${sedeB}/mapa/puntos`)
      .set(...auth(empresaA.token))
      .send({ tipo: 'extintor', nombre: 'EXT', lat: 6.17, lng: -75.6 });
    assert.equal(ajeno.status, 404);
    assert.equal((await api().put(`/api/sedes/${sedeA}/mapa/puntos/no-es-uuid`).set(...auth(empresaA.token)).send({ lat: 6 })).status, 404);
  });

  test('los cambios se avisan de inmediato a las personas conectadas', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token);
    const empleado = await invitarYAceptar(token, 'empleado');
    const ws = await conectar(empleado.token);

    await api()
      .post(`/api/sedes/${sede}/mapa/puntos`)
      .set(...auth(token))
      .send({ tipo: 'punto_encuentro', nombre: 'Parqueadero', lat: 6.17, lng: -75.6 });
    const evento = await esperarEvento(ws, 'mapa:actualizado');
    ws.close();
    assert.equal(evento?.data.sedeId, sede);
  });
});

describe('HU-09 · Enviar alerta de emergencia', () => {
  test('la alerta indica tipo, sede e instrucciones y la ven las personas de esa sede', async () => {
    const e = await escenario();
    const enviada = await enviarAlerta(e.brigadista.token, e.planta);
    assert.equal(enviada.status, 201);
    assert.equal(enviada.body.alerta.tipo, 'incendio');
    assert.equal(enviada.body.alerta.sedeNombre, 'Planta');
    assert.ok(enviada.body.alerta.instrucciones);
    // Brigadista, empleado de la Planta y el administrador (sin sede).
    assert.equal(enviada.body.destinatarios, 3);

    const delEmpleado = await api().get('/api/alertas/activa').set(...auth(e.empleado.token));
    assert.equal(delEmpleado.body.alerta.id, enviada.body.alerta.id);
    const deOtraSede = await api().get('/api/alertas/activa').set(...auth(e.deBodega.token));
    assert.equal(deOtraSede.body.alerta, null);
  });

  test('solo administradores y brigadistas envían alertas, y no se duplican por sede', async () => {
    const e = await escenario();
    assert.equal((await enviarAlerta(e.empleado.token, e.planta)).status, 403);
    assert.equal((await enviarAlerta(e.token, e.planta)).status, 201);
    const otra = await enviarAlerta(e.token, e.planta, { tipo: 'sismo' });
    assert.equal(otra.status, 409);
    assert.equal(otra.body.error.codigo, 'ALERTA_ACTIVA');
    assert.equal((await enviarAlerta(e.token, e.planta, { tipo: 'volcan' })).status, 400);
  });
});

describe('HU-10 · Confirmar estado en una emergencia', () => {
  test('el empleado marca su estado y el brigadista ve confirmados y pendientes de la sede', async () => {
    const e = await escenario();
    const alerta = (await enviarAlerta(e.token, e.planta)).body.alerta;
    const url = `/api/alertas/${alerta.id}/respuestas`;

    const marcada = await api().post(url).set(...auth(e.empleado.token)).send({ estado: 'necesita_ayuda', mensaje: 'Piso 2' });
    assert.equal(marcada.status, 201);

    const panel = await api().get(url).set(...auth(e.brigadista.token));
    assert.equal(panel.status, 200);
    assert.deepEqual(panel.body.respuestas.map((r) => [r.usuario.id, r.estado]), [[e.empleado.id, 'necesita_ayuda']]);
    const pendientes = panel.body.pendientes.map((p) => p.usuario.id);
    assert.ok(pendientes.includes(e.brigadista.id));
    assert.ok(!pendientes.includes(e.deBodega.id), 'quien es de otra sede no queda pendiente');

    // El empleado puede cambiar de estado mientras la alerta está activa.
    await api().post(url).set(...auth(e.empleado.token)).send({ estado: 'a_salvo' });
    const despues = await api().get(url).set(...auth(e.brigadista.token));
    assert.equal(despues.body.respuestas[0].estado, 'a_salvo');
  });

  test('solo se responde durante una alerta activa y de la propia sede', async () => {
    const e = await escenario();
    const alerta = (await enviarAlerta(e.token, e.planta)).body.alerta;
    const url = `/api/alertas/${alerta.id}/respuestas`;

    const otraSede = await api().post(url).set(...auth(e.deBodega.token)).send({ estado: 'a_salvo' });
    assert.equal(otraSede.status, 403);

    assert.equal((await api().post(`/api/alertas/${alerta.id}/finalizar`).set(...auth(e.brigadista.token))).status, 200);
    const tarde = await api().post(url).set(...auth(e.empleado.token)).send({ estado: 'a_salvo' });
    assert.equal(tarde.status, 409);
    assert.equal(tarde.body.error.codigo, 'ALERTA_FINALIZADA');
  });

  test('la lista de respuestas es solo para brigadistas y administradores de la misma empresa', async () => {
    const e = await escenario();
    const ajena = await registrarEmpresa();
    const alerta = (await enviarAlerta(e.token, e.planta)).body.alerta;
    const url = `/api/alertas/${alerta.id}/respuestas`;

    assert.equal((await api().get(url).set(...auth(e.empleado.token))).status, 403);
    assert.equal((await api().get(url).set(...auth(ajena.token))).status, 404);
    assert.equal((await api().post(url).set(...auth(ajena.token)).send({ estado: 'a_salvo' })).status, 404);
  });

  test('las respuestas llegan en tiempo real al panel del brigadista', async () => {
    const e = await escenario();
    const alerta = (await enviarAlerta(e.token, e.planta)).body.alerta;
    const ws = await conectar(e.brigadista.token);
    ws.send(JSON.stringify({ action: 'join', room: `alerta:${alerta.id}` }));
    assert.ok(await esperarEvento(ws, 'joined'));

    await api().post(`/api/alertas/${alerta.id}/respuestas`).set(...auth(e.empleado.token)).send({ estado: 'a_salvo' });
    const evento = await esperarEvento(ws, 'alerta:respuesta');
    ws.close();
    assert.equal(evento?.data.usuario.id, e.empleado.id);
  });
});

describe('HU-11 · Inventario de equipos', () => {
  test('cada equipo queda asociado a una sede con su fecha exacta de vencimiento', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token);
    const creado = await api()
      .post(`/api/sedes/${sede}/equipos`)
      .set(...auth(token))
      .send({ tipo: 'extintor', nombre: 'EXT-01', ubicacion: 'Recepción', fechaVencimiento: '2026-12-01' });
    assert.equal(creado.status, 201);
    assert.equal(creado.body.equipo.sedeId, sede);
    assert.equal(creado.body.equipo.fechaVencimiento, '2026-12-01');

    // Registrar la recarga cambia la fecha; null deja el equipo sin vencimiento.
    const recargado = await api().put(`/api/equipos/${creado.body.equipo.id}`).set(...auth(token)).send({ fechaVencimiento: '2027-12-01' });
    assert.equal(recargado.body.equipo.fechaVencimiento, '2027-12-01');
    assert.equal(recargado.body.equipo.nombre, 'EXT-01');
    const sinFecha = await api().put(`/api/equipos/${creado.body.equipo.id}`).set(...auth(token)).send({ fechaVencimiento: null });
    assert.equal(sinFecha.body.equipo.fechaVencimiento, null);

    const lista = await api().get(`/api/sedes/${sede}/equipos`).set(...auth(token));
    assert.equal(lista.body.equipos.length, 1);
  });

  test('valida los datos y protege el inventario', async () => {
    const empresaA = await registrarEmpresa();
    const empresaB = await registrarEmpresa();
    const sedeA = await crearSede(empresaA.token);
    const sedeB = await crearSede(empresaB.token);
    const empleado = await invitarYAceptar(empresaA.token, 'empleado');

    const invalido = await api()
      .post(`/api/sedes/${sedeA}/equipos`)
      .set(...auth(empresaA.token))
      .send({ tipo: 'manguera', nombre: 'X', ubicacion: 'Y', fechaVencimiento: '31/12/2026' });
    assert.equal(invalido.status, 400);
    assert.ok(invalido.body.error.campos.tipo && invalido.body.error.campos.fechaVencimiento);

    const datos = { tipo: 'botiquin', nombre: 'BOT-01', ubicacion: 'Portería' };
    assert.equal((await api().post(`/api/sedes/${sedeA}/equipos`).set(...auth(empleado.token)).send(datos)).status, 403);
    assert.equal((await api().post(`/api/sedes/${sedeB}/equipos`).set(...auth(empresaA.token)).send(datos)).status, 404);
    const deB = await api().post(`/api/sedes/${sedeB}/equipos`).set(...auth(empresaB.token)).send(datos);
    assert.equal((await api().delete(`/api/equipos/${deB.body.equipo.id}`).set(...auth(empresaA.token))).status, 404);
  });
});

describe('Tiempo real · seguridad', () => {
  test('sin autenticarse no se puede entrar a ninguna sala', async () => {
    const e = await escenario();
    const ws = await conectar(null);
    ws.send(JSON.stringify({ action: 'join', room: `empresa:${e.res.body.empresa.id}` }));
    const error = await esperarEvento(ws, 'error');
    ws.close();
    assert.equal(error?.data.codigo, 'NO_AUTENTICADO');
  });

  test('un token inválido cierra la conexión', async () => {
    const ws = await conectar(null);
    const cerrada = new Promise((resolve) => ws.once('close', resolve));
    ws.send(JSON.stringify({ action: 'auth', token: 'inventado' }));
    assert.equal(await cerrada, 4401);
  });

  test('no se puede escuchar a otra empresa ni el panel de respuestas sin permiso', async () => {
    const e = await escenario();
    const ajena = await escenario();
    const alerta = (await enviarAlerta(ajena.token, ajena.planta)).body.alerta;

    const espia = await conectar(e.token);
    espia.send(JSON.stringify({ action: 'join', room: `empresa:${ajena.res.body.empresa.id}` }));
    espia.send(JSON.stringify({ action: 'join', room: `alerta:${alerta.id}` }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(espia.eventos.filter((m) => m.event === 'error' && m.data.codigo === 'SIN_PERMISO').length, 2);

    // Un empleado de la misma empresa tampoco entra al panel de respuestas.
    const alertaPropia = (await enviarAlerta(e.token, e.planta)).body.alerta;
    const empleado = await conectar(e.empleado.token);
    empleado.send(JSON.stringify({ action: 'join', room: `alerta:${alertaPropia.id}` }));
    const negado = await esperarEvento(empleado, 'error');
    espia.close();
    empleado.close();
    assert.equal(negado?.data.codigo, 'SIN_PERMISO');
  });
});
