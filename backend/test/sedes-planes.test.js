// Pruebas de integración de HU-04 (sedes) y HU-05 (plan de emergencias).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { api, auth, invitarYAceptar, registrarEmpresa, usarBaseDePruebas } from './helpers.js';

usarBaseDePruebas();

const SEDE = {
  nombre: 'Planta Norte',
  direccion: 'Calle 50 # 41-20',
  ciudad: 'Itagüí',
  lat: 6.1752,
  lng: -75.6052,
};

async function crearSede(token, cambios = {}) {
  return api()
    .post('/api/sedes')
    .set(...auth(token))
    .send({ ...SEDE, ...cambios });
}

// Contenido mínimo que cumple las reglas para aprobar.
const CONTENIDO_COMPLETO = {
  riesgos: [{ id: 'r1', tipo: 'Sismo', descripcion: 'Zona de amenaza sísmica intermedia.', nivel: 'medio' }],
  procedimientos: [{ id: 'p1', titulo: 'Evacuación', pasos: ['Salir por la ruta señalizada.', ''] }],
  puntosEncuentro: [{ id: 'e1', nombre: 'Parqueadero', referencia: 'Frente a la portería.', capacidad: 80 }],
};

describe('HU-04 · Gestión de sedes', () => {
  test('una empresa puede tener varias sedes, cada una con su ubicación', async () => {
    const { token } = await registrarEmpresa();
    assert.equal((await crearSede(token)).status, 201);
    const segunda = await crearSede(token, { nombre: 'Bodega Sur', lat: 6.15, lng: -75.61 });
    assert.equal(segunda.status, 201);
    assert.deepEqual([segunda.body.sede.lat, segunda.body.sede.lng], [6.15, -75.61]);

    const lista = await api().get('/api/sedes').set(...auth(token));
    assert.equal(lista.body.sedes.length, 2);
    assert.ok(lista.body.sedes.every((s) => typeof s.lat === 'number' && typeof s.lng === 'number'));
  });

  test('no se puede registrar una sede sin ubicación en el mapa', async () => {
    const { token } = await registrarEmpresa();
    const res = await crearSede(token, { lat: undefined, lng: undefined });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.campos.lat);
  });

  test('el nombre de la sede no se repite dentro de la empresa', async () => {
    const { token } = await registrarEmpresa();
    await crearSede(token);
    const repetida = await crearSede(token, { nombre: 'planta norte' });
    assert.equal(repetida.status, 409);
    assert.equal(repetida.body.error.codigo, 'SEDE_DUPLICADA');
  });

  test('editar y eliminar una sede', async () => {
    const { token } = await registrarEmpresa();
    const { id } = (await crearSede(token)).body.sede;

    const editada = await api()
      .put(`/api/sedes/${id}`)
      .set(...auth(token))
      .send({ ...SEDE, nombre: 'Planta Norte II', lat: 6.2 });
    assert.equal(editada.body.sede.nombre, 'Planta Norte II');
    assert.equal(editada.body.sede.lat, 6.2);

    assert.equal((await api().delete(`/api/sedes/${id}`).set(...auth(token))).status, 204);
    assert.equal((await api().get(`/api/sedes/${id}`).set(...auth(token))).status, 404);
  });

  test('los demás roles ven las sedes pero no las modifican', async () => {
    const { token } = await registrarEmpresa();
    await crearSede(token);
    const empleado = await invitarYAceptar(token, 'empleado');

    assert.equal((await api().get('/api/sedes').set(...auth(empleado.token))).body.sedes.length, 1);
    assert.equal((await crearSede(empleado.token, { nombre: 'Otra' })).status, 403);
  });

  test('no se ven sedes de otra empresa', async () => {
    const empresaA = await registrarEmpresa();
    const empresaB = await registrarEmpresa();
    const { id } = (await crearSede(empresaB.token)).body.sede;

    assert.equal((await api().get(`/api/sedes/${id}`).set(...auth(empresaA.token))).status, 404);
    assert.equal((await api().get(`/api/sedes/${id}/plan`).set(...auth(empresaA.token))).status, 404);
  });
});

describe('HU-05 · Plan de emergencias', () => {
  async function sedeConPlan({ plantilla = false } = {}) {
    const empresa = await registrarEmpresa();
    const { id } = (await crearSede(empresa.token)).body.sede;
    const res = await api()
      .post(`/api/sedes/${id}/plan`)
      .set(...auth(empresa.token))
      .send({ plantilla });
    return { ...empresa, idSede: id, res, url: `/api/sedes/${id}/plan` };
  }

  test('el plan nace en borrador y registra quién lo creó y cuándo', async () => {
    const { res } = await sedeConPlan();
    assert.equal(res.status, 201);
    assert.equal(res.body.borrador.estado, 'borrador');
    assert.equal(res.body.borrador.numero, 1);
    assert.equal(res.body.plan.creadoPor.nombre, 'Admin Prueba');
    assert.ok(res.body.plan.creadoEn);
    assert.equal(res.body.vigente, null);
  });

  test('la plantilla trae riesgos y procedimientos sugeridos', async () => {
    const { res } = await sedeConPlan({ plantilla: true });
    assert.ok(res.body.borrador.contenido.riesgos.length > 0);
    assert.ok(res.body.borrador.contenido.procedimientos.length > 0);
  });

  test('no se aprueba un plan incompleto', async () => {
    const { token, url } = await sedeConPlan();
    const res = await api().post(`${url}/borrador/aprobar`).set(...auth(token));
    assert.equal(res.status, 422);
    assert.equal(res.body.error.codigo, 'PLAN_INCOMPLETO');
    assert.ok(res.body.error.campos.riesgos && res.body.error.campos.puntosEncuentro);
  });

  test('se guarda el borrador, se aprueba y queda quién lo aprobó', async () => {
    const { token, url, idSede } = await sedeConPlan();
    const guardado = await api()
      .put(`${url}/borrador`)
      .set(...auth(token))
      .send({ contenido: CONTENIDO_COMPLETO });
    assert.equal(guardado.status, 200);

    const aprobado = await api().post(`${url}/borrador/aprobar`).set(...auth(token));
    assert.equal(aprobado.status, 200);
    assert.equal(aprobado.body.vigente.estado, 'aprobado');
    assert.equal(aprobado.body.vigente.aprobadoPor.nombre, 'Admin Prueba');
    assert.ok(aprobado.body.vigente.aprobadoEn);
    assert.equal(aprobado.body.borrador, null);
    // Los pasos vacíos se descartan al aprobar.
    assert.deepEqual(aprobado.body.vigente.contenido.procedimientos[0].pasos, ['Salir por la ruta señalizada.']);

    const sede = await api().get(`/api/sedes/${idSede}`).set(...auth(token));
    assert.equal(sede.body.sede.plan.estado, 'aprobado');
  });

  test('un plan aprobado no se edita: se crea una versión nueva', async () => {
    const { token, url } = await sedeConPlan();
    await api().put(`${url}/borrador`).set(...auth(token)).send({ contenido: CONTENIDO_COMPLETO });
    await api().post(`${url}/borrador/aprobar`).set(...auth(token));

    const editar = await api().put(`${url}/borrador`).set(...auth(token)).send({ contenido: CONTENIDO_COMPLETO });
    assert.equal(editar.status, 409);

    const v2 = await api().post(`${url}/versiones`).set(...auth(token));
    assert.equal(v2.status, 201);
    assert.equal(v2.body.borrador.numero, 2);
    assert.equal(v2.body.vigente.numero, 1);
    assert.deepEqual(v2.body.borrador.contenido, v2.body.vigente.contenido);

    const otra = await api().post(`${url}/versiones`).set(...auth(token));
    assert.equal(otra.status, 409);
  });

  test('descartar el único borrador deja la sede sin plan', async () => {
    const { token, url } = await sedeConPlan();
    const res = await api().delete(`${url}/borrador`).set(...auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.plan, null);
  });

  test('los demás roles solo ven el plan aprobado y no lo editan', async () => {
    const { token, url } = await sedeConPlan();
    const brigadista = await invitarYAceptar(token, 'brigadista');

    const antes = await api().get(url).set(...auth(brigadista.token));
    assert.equal(antes.body.plan, null);

    await api().put(`${url}/borrador`).set(...auth(token)).send({ contenido: CONTENIDO_COMPLETO });
    await api().post(`${url}/borrador/aprobar`).set(...auth(token));
    await api().post(`${url}/versiones`).set(...auth(token));

    const despues = await api().get(url).set(...auth(brigadista.token));
    assert.equal(despues.body.vigente.numero, 1);
    assert.equal(despues.body.borrador, null);
    assert.ok(despues.body.versiones.every((v) => v.estado === 'aprobado'));

    const aprobar = await api().post(`${url}/borrador/aprobar`).set(...auth(brigadista.token));
    assert.equal(aprobar.status, 403);
  });
});
