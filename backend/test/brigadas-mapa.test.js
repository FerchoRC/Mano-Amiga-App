// Pruebas de integración de HU-06 (brigadas) y HU-07 (mapa de la sede).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { api, auth, invitarYAceptar, pool, registrarEmpresa, usarBaseDePruebas } from './helpers.js';

usarBaseDePruebas();

async function empresaConSede() {
  const empresa = await registrarEmpresa();
  const sede = await api()
    .post('/api/sedes')
    .set(...auth(empresa.token))
    .send({ nombre: 'Planta Norte', direccion: 'Calle 50 # 41-20', ciudad: 'Itagüí', lat: 6.1752, lng: -75.6052 });
  return { ...empresa, idSede: sede.body.sede.id };
}

const crearBrigada = (token, datos) => api().post('/api/brigadas').set(...auth(token)).send(datos);

describe('HU-06 · Conformar brigadas', () => {
  test('cada brigada tiene un líder que es parte de ella', async () => {
    const { token, idSede } = await empresaConSede();
    const ana = await invitarYAceptar(token, 'brigadista');
    const beto = await invitarYAceptar(token, 'brigadista');

    const res = await crearBrigada(token, {
      sedeId: idSede,
      tipo: 'evacuacion',
      liderId: ana.id,
      miembrosIds: [ana.id, beto.id],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.brigada.lider.id, ana.id);
    assert.equal(res.body.brigada.miembros.length, 2);
    assert.ok(res.body.brigada.miembros.find((m) => m.id === ana.id).esLider);

    const sinLiderEnMiembros = await crearBrigada(token, {
      sedeId: idSede,
      tipo: 'primeros_auxilios',
      liderId: ana.id,
      miembrosIds: [beto.id],
    });
    assert.equal(sinLiderEnMiembros.status, 400);
    assert.ok(sinLiderEnMiembros.body.error.campos.liderId);

    const sinLider = await crearBrigada(token, { sedeId: idSede, tipo: 'primeros_auxilios', miembrosIds: [beto.id] });
    assert.equal(sinLider.status, 400);
    assert.ok(sinLider.body.error.campos.liderId);
  });

  test('un brigadista puede pertenecer a varias brigadas', async () => {
    const { token, idSede } = await empresaConSede();
    const ana = await invitarYAceptar(token, 'brigadista');

    for (const tipo of ['evacuacion', 'primeros_auxilios', 'contra_incendios']) {
      const res = await crearBrigada(token, { sedeId: idSede, tipo, liderId: ana.id, miembrosIds: [ana.id] });
      assert.equal(res.status, 201);
    }
    const lista = await api().get(`/api/brigadas?sede=${idSede}`).set(...auth(token));
    assert.equal(lista.body.brigadas.length, 3);
    assert.ok(lista.body.brigadas.every((b) => b.miembros.some((m) => m.id === ana.id)));
  });

  test('una sede no repite el tipo de brigada', async () => {
    const { token, idSede } = await empresaConSede();
    const ana = await invitarYAceptar(token, 'brigadista');
    const datos = { sedeId: idSede, tipo: 'evacuacion', liderId: ana.id, miembrosIds: [ana.id] };
    await crearBrigada(token, datos);

    const repetida = await crearBrigada(token, datos);
    assert.equal(repetida.status, 409);
    assert.equal(repetida.body.error.codigo, 'BRIGADA_EXISTENTE');
  });

  test('solo se asignan brigadistas activos', async () => {
    const { token, idSede } = await empresaConSede();
    const empleado = await invitarYAceptar(token, 'empleado');
    const res = await crearBrigada(token, {
      sedeId: idSede,
      tipo: 'evacuacion',
      liderId: empleado.id,
      miembrosIds: [empleado.id],
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.campos.miembrosIds);
  });

  test('editar cambia el líder y los miembros; quien sigue conserva su fecha de ingreso', async () => {
    const { token, idSede } = await empresaConSede();
    const ana = await invitarYAceptar(token, 'brigadista');
    const beto = await invitarYAceptar(token, 'brigadista');
    const caro = await invitarYAceptar(token, 'brigadista');
    const creada = await crearBrigada(token, {
      sedeId: idSede,
      tipo: 'evacuacion',
      liderId: ana.id,
      miembrosIds: [ana.id, beto.id],
    });
    const ingresoBeto = creada.body.brigada.miembros.find((m) => m.id === beto.id).fechaIngreso;

    const editada = await api()
      .put(`/api/brigadas/${creada.body.brigada.id}`)
      .set(...auth(token))
      .send({ liderId: beto.id, miembrosIds: [beto.id, caro.id] });
    assert.equal(editada.status, 200);
    assert.equal(editada.body.brigada.lider.id, beto.id);
    assert.deepEqual(editada.body.brigada.miembros.map((m) => m.id).sort(), [beto.id, caro.id].sort());
    assert.equal(editada.body.brigada.miembros.find((m) => m.id === beto.id).fechaIngreso, ingresoBeto);
  });

  test('los demás roles ven las brigadas pero no las gestionan', async () => {
    const { token, idSede } = await empresaConSede();
    const brigadista = await invitarYAceptar(token, 'brigadista');
    const creada = await crearBrigada(token, {
      sedeId: idSede,
      tipo: 'evacuacion',
      liderId: brigadista.id,
      miembrosIds: [brigadista.id],
    });

    const lista = await api().get('/api/brigadas').set(...auth(brigadista.token));
    assert.equal(lista.body.brigadas.length, 1);
    const borrar = await api().delete(`/api/brigadas/${creada.body.brigada.id}`).set(...auth(brigadista.token));
    assert.equal(borrar.status, 403);
  });

  test('no se ven brigadas de otra empresa', async () => {
    const empresaA = await empresaConSede();
    const empresaB = await empresaConSede();
    const deB = await invitarYAceptar(empresaB.token, 'brigadista');
    const creada = await crearBrigada(empresaB.token, {
      sedeId: empresaB.idSede,
      tipo: 'evacuacion',
      liderId: deB.id,
      miembrosIds: [deB.id],
    });

    assert.equal((await api().get('/api/brigadas').set(...auth(empresaA.token))).body.brigadas.length, 0);
    assert.equal((await api().get(`/api/brigadas/${creada.body.brigada.id}`).set(...auth(empresaA.token))).status, 404);
    // Ni crear una brigada en una sede ajena.
    const ajena = await crearBrigada(empresaA.token, {
      sedeId: empresaB.idSede,
      tipo: 'primeros_auxilios',
      liderId: deB.id,
      miembrosIds: [deB.id],
    });
    assert.equal(ajena.status, 404);
  });
});

describe('HU-07 · Mapa de la sede', () => {
  test('cualquier rol ve los puntos y rutas de la sede', async () => {
    const { token, idSede } = await empresaConSede();
    await pool.query(
      `INSERT INTO mapa_punto (id_sede, tipo, nombre, lat, lng) VALUES
         ($1, 'punto_encuentro', 'Parqueadero', 6.1754, -75.6047),
         ($1, 'extintor', 'EXT-01', 6.1752, -75.6052)`,
      [idSede]
    );
    await pool.query(
      `INSERT INTO mapa_ruta (id_sede, nombre, trazado) VALUES ($1, 'Ruta principal', $2)`,
      [idSede, JSON.stringify([[6.1752, -75.6052], [6.1754, -75.6047]])]
    );
    const empleado = await invitarYAceptar(token, 'empleado');

    const res = await api().get(`/api/sedes/${idSede}/mapa`).set(...auth(empleado.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.puntos.length, 2);
    assert.deepEqual(res.body.puntos.map((p) => p.tipo).sort(), ['extintor', 'punto_encuentro']);
    assert.equal(typeof res.body.puntos[0].lat, 'number');
    assert.deepEqual(res.body.rutas[0].trazado, [[6.1752, -75.6052], [6.1754, -75.6047]]);
  });

  test('una sede sin elementos devuelve el mapa vacío', async () => {
    const { token, idSede } = await empresaConSede();
    const res = await api().get(`/api/sedes/${idSede}/mapa`).set(...auth(token));
    assert.deepEqual([res.body.puntos, res.body.rutas], [[], []]);
  });

  test('no se ve el mapa de una sede de otra empresa', async () => {
    const empresaA = await empresaConSede();
    const empresaB = await empresaConSede();
    const res = await api().get(`/api/sedes/${empresaB.idSede}/mapa`).set(...auth(empresaA.token));
    assert.equal(res.status, 404);
  });
});
