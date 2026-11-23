// Pruebas de integración de HU-12 (reporte para auditoría), HU-13 (panel de
// cumplimiento) y del registro de simulacros que alimenta a ambas.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { api, auth, invitarYAceptar, pool, registrarEmpresa, usarBaseDePruebas } from './helpers.js';

const { hoyEnColombia, sumarDias } = await import('../src/lib/fechas.js');
const { cargarDatos } = await import('../src/services/cumplimiento.js');
const { prepararSedes } = await import('../src/services/reporteAuditoria.js');

usarBaseDePruebas();

const HOY = hoyEnColombia();
const enDias = (n) => sumarDias(HOY, n);

const crearSede = (token, nombre) =>
  api()
    .post('/api/sedes')
    .set(...auth(token))
    .send({ nombre, direccion: 'Calle 50 # 41-20', ciudad: 'Itagüí', lat: 6.1752, lng: -75.6052 })
    .then((r) => r.body.sede.id);

const cumplimiento = (token, sedeId) =>
  api()
    .get(`/api/cumplimiento${sedeId ? `?sedeId=${sedeId}` : ''}`)
    .set(...auth(token));

const indicador = (res, id) => res.body.indicadores.find((i) => i.id === id);

const registrarSimulacro = (token, sedeId, datos = {}) =>
  api()
    .post(`/api/sedes/${sedeId}/simulacros`)
    .set(...auth(token))
    .send({ fecha: enDias(-10), participantes: 30, tiempoEvacuacion: '4 min', ...datos });

const registrarEquipo = (token, sedeId, datos = {}) =>
  api()
    .post(`/api/sedes/${sedeId}/equipos`)
    .set(...auth(token))
    .send({ tipo: 'extintor', nombre: 'EXT-01', ubicacion: 'Recepción', fechaVencimiento: enDias(200), estado: 'operativo', ...datos });

const CONTENIDO_PLAN = {
  riesgos: [{ id: 'r1', tipo: 'Sismo', descripcion: 'Zona de amenaza sísmica intermedia.', nivel: 'medio' }],
  procedimientos: [{ id: 'p1', titulo: 'Evacuación', pasos: ['Sal por la ruta señalizada.'] }],
  puntosEncuentro: [{ id: 'e1', nombre: 'Parqueadero', referencia: 'Frente a la portería.', capacidad: 80 }],
};

async function aprobarPlan(token, sedeId) {
  await api().post(`/api/sedes/${sedeId}/plan`).set(...auth(token)).send({});
  await api().put(`/api/sedes/${sedeId}/plan/borrador`).set(...auth(token)).send({ contenido: CONTENIDO_PLAN });
  const res = await api().post(`/api/sedes/${sedeId}/plan/borrador/aprobar`).set(...auth(token));
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

async function conformarBrigadas(token, sedeId) {
  const brigadista = await invitarYAceptar(token, 'brigadista');
  for (const tipo of ['primeros_auxilios', 'evacuacion', 'contra_incendios']) {
    const res = await api()
      .post('/api/brigadas')
      .set(...auth(token))
      .send({ sedeId, tipo, liderId: brigadista.id, miembrosIds: [brigadista.id] });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
}

const agregarPunto = (token, sedeId, tipo) =>
  api()
    .post(`/api/sedes/${sedeId}/mapa/puntos`)
    .set(...auth(token))
    .send({ tipo, nombre: `Punto ${tipo}`, lat: 6.1752, lng: -75.6052 });

describe('Simulacros', () => {
  test('el administrador registra un simulacro y queda con la fecha exacta', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');

    const res = await registrarSimulacro(token, sede, {
      fecha: '2026-03-12',
      observaciones: '  La alarma no se escuchó en bodega.  ',
      planMejora: '',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.simulacro.fecha, '2026-03-12');
    assert.equal(res.body.simulacro.observaciones, 'La alarma no se escuchó en bodega.');
    assert.equal(res.body.simulacro.planMejora, null);
    assert.equal(res.body.simulacro.registradoPor, 'Admin Prueba');

    const lista = await api().get(`/api/sedes/${sede}/simulacros`).set(...auth(token));
    assert.equal(lista.body.simulacros.length, 1);
  });

  test('rechaza datos inválidos con el error de cada campo', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');

    const futura = await registrarSimulacro(token, sede, { fecha: enDias(3) });
    assert.equal(futura.status, 400);
    assert.ok(futura.body.error.campos.fecha);

    const sinGente = await registrarSimulacro(token, sede, { participantes: 0 });
    assert.equal(sinGente.status, 400);
    assert.ok(sinGente.body.error.campos.participantes);

    const sinFecha = await registrarSimulacro(token, sede, { fecha: 'ayer' });
    assert.equal(sinFecha.status, 400);
  });

  test('solo el administrador registra o borra, y nunca en otra empresa', async () => {
    const empresa = await registrarEmpresa();
    const sede = await crearSede(empresa.token, 'Planta');
    const brigadista = await invitarYAceptar(empresa.token, 'brigadista');

    assert.equal((await registrarSimulacro(brigadista.token, sede)).status, 403);
    // Todos pueden ver los simulacros de su empresa.
    assert.equal((await api().get(`/api/sedes/${sede}/simulacros`).set(...auth(brigadista.token))).status, 200);

    const otra = await registrarEmpresa();
    assert.equal((await registrarSimulacro(otra.token, sede)).status, 404);
    assert.equal((await api().get(`/api/sedes/${sede}/simulacros`).set(...auth(otra.token))).status, 404);

    const creado = (await registrarSimulacro(empresa.token, sede)).body.simulacro;
    const ajeno = await api().delete(`/api/sedes/${sede}/simulacros/${creado.id}`).set(...auth(otra.token));
    assert.equal(ajeno.status, 404);
    const borrado = await api().delete(`/api/sedes/${sede}/simulacros/${creado.id}`).set(...auth(empresa.token));
    assert.equal(borrado.status, 204);
  });
});

describe('HU-13 · Panel de cumplimiento', () => {
  test('una sede sin nada queda en rojo y cada indicador dice qué falta', async () => {
    const { token } = await registrarEmpresa();
    await crearSede(token, 'Planta');

    const res = await cumplimiento(token);
    assert.equal(res.status, 200);
    assert.equal(res.body.indicadores.length, 5);
    assert.equal(res.body.porcentajeGlobal, 0);
    assert.deepEqual(res.body.resumen, { cumplidos: 0, enProgreso: 0, criticos: 5, total: 5 });

    for (const ind of res.body.indicadores) {
      assert.equal(ind.estado, 'rojo', ind.id);
      assert.ok(['verde', 'amarillo', 'rojo'].includes(ind.estado));
      assert.ok(ind.queFalta.length > 10, `${ind.id} explica qué falta`);
      assert.ok(ind.detalles.length > 0, `${ind.id} trae el detalle`);
      assert.ok(ind.detalles.every((d) => d.cumple === false));
      assert.ok(ind.accion.ruta.startsWith('/'));
    }
    assert.match(indicador(res, 'plan_emergencia').queFalta, /Crea el plan de Planta/);
  });

  test('una sede completa queda toda en verde', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');
    await aprobarPlan(token, sede);
    await conformarBrigadas(token, sede);
    await registrarSimulacro(token, sede);
    await registrarEquipo(token, sede);
    await agregarPunto(token, sede, 'punto_encuentro');
    await api()
      .post(`/api/sedes/${sede}/mapa/rutas`)
      .set(...auth(token))
      .send({ nombre: 'Ruta principal', trazado: [[6.1752, -75.6052], [6.1758, -75.6045]] });

    const res = await cumplimiento(token);
    for (const ind of res.body.indicadores) assert.equal(ind.estado, 'verde', `${ind.id}: ${ind.queFalta}`);
    assert.equal(res.body.porcentajeGlobal, 100);
    assert.equal(res.body.resumen.cumplidos, 5);
  });

  test('el plan en borrador y el avance parcial se ven en amarillo', async () => {
    const { token } = await registrarEmpresa();
    const planta = await crearSede(token, 'Planta');
    const bodega = await crearSede(token, 'Bodega');
    await api().post(`/api/sedes/${planta}/plan`).set(...auth(token)).send({ plantilla: true });
    await agregarPunto(token, bodega, 'punto_encuentro');

    const res = await cumplimiento(token);
    const plan = indicador(res, 'plan_emergencia');
    assert.equal(plan.estado, 'amarillo');
    assert.match(plan.queFalta, /aprueba el borrador de Planta/);
    assert.match(plan.queFalta, /Crea el plan de Bodega/);
    assert.equal(indicador(res, 'mapa_evacuacion').estado, 'amarillo');
  });

  test('un equipo vencido pone el inventario en rojo; uno por vencer, en amarillo', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');
    const vencido = (await registrarEquipo(token, sede, { nombre: 'EXT-03', fechaVencimiento: enDias(-20) })).body.equipo;
    await registrarEquipo(token, sede, { nombre: 'EXT-01', fechaVencimiento: enDias(200) });

    let ind = indicador(await cumplimiento(token), 'inventario_equipos');
    assert.equal(ind.estado, 'rojo');
    assert.equal(ind.porcentaje, 50);
    assert.ok(ind.detalles.some((d) => !d.cumple && /EXT-03 · Planta: vencido hace 20 días/.test(d.texto)));

    await api().put(`/api/equipos/${vencido.id}`).set(...auth(token)).send({ fechaVencimiento: enDias(10) });
    ind = indicador(await cumplimiento(token), 'inventario_equipos');
    assert.equal(ind.estado, 'amarillo');
    assert.ok(ind.detalles.some((d) => /EXT-03 · Planta: vence en 10 días/.test(d.texto)));

    // Un equipo dado de baja ya no cuenta.
    await api().put(`/api/equipos/${vencido.id}`).set(...auth(token)).send({ estado: 'baja' });
    ind = indicador(await cumplimiento(token), 'inventario_equipos');
    assert.equal(ind.estado, 'verde');
  });

  test('un simulacro de hace más de un año ya no cuenta', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');
    await registrarSimulacro(token, sede, { fecha: enDias(-400) });

    let ind = indicador(await cumplimiento(token), 'simulacros');
    assert.equal(ind.estado, 'rojo');
    assert.match(ind.detalles[0].texto, /hace más de un año/);

    await registrarSimulacro(token, sede, { fecha: enDias(-30) });
    ind = indicador(await cumplimiento(token), 'simulacros');
    assert.equal(ind.estado, 'verde');
  });

  test('se puede filtrar por sede y no mezcla datos de otra empresa', async () => {
    const empresa = await registrarEmpresa();
    const planta = await crearSede(empresa.token, 'Planta');
    const bodega = await crearSede(empresa.token, 'Bodega');
    await registrarSimulacro(empresa.token, planta);

    const soloPlanta = await cumplimiento(empresa.token, planta);
    assert.equal(soloPlanta.status, 200);
    assert.equal(indicador(soloPlanta, 'simulacros').estado, 'verde');
    assert.equal(indicador(soloPlanta, 'plan_emergencia').detalles.length, 1);

    const soloBodega = await cumplimiento(empresa.token, bodega);
    assert.equal(indicador(soloBodega, 'simulacros').estado, 'rojo');

    const todas = await cumplimiento(empresa.token);
    assert.equal(indicador(todas, 'simulacros').estado, 'amarillo');

    const otra = await registrarEmpresa();
    assert.equal((await cumplimiento(otra.token, planta)).status, 404);
    assert.equal((await cumplimiento(empresa.token, 'no-es-un-id')).status, 404);
    const vacia = await cumplimiento(otra.token);
    assert.equal(vacia.body.sinSedes, true);
    assert.equal(vacia.body.indicadores.length, 0);
  });

  test('solo el administrador ve el panel', async () => {
    const { token } = await registrarEmpresa();
    const brigadista = await invitarYAceptar(token, 'brigadista');
    const empleado = await invitarYAceptar(token, 'empleado');
    assert.equal((await cumplimiento(brigadista.token)).status, 403);
    assert.equal((await cumplimiento(empleado.token)).status, 403);
    assert.equal((await api().get('/api/cumplimiento')).status, 401);
  });
});

describe('HU-12 · Reporte para auditoría', () => {
  const reporte = (token, query = '') =>
    api()
      .get(`/api/reportes/auditoria${query}`)
      .set(...auth(token))
      .buffer(true)
      .parse((res, done) => {
        const partes = [];
        res.on('data', (p) => partes.push(p));
        res.on('end', () => done(null, Buffer.concat(partes)));
      });

  test('se descarga en PDF', async () => {
    const { token } = await registrarEmpresa();
    const sede = await crearSede(token, 'Planta');
    await aprobarPlan(token, sede);
    await registrarSimulacro(token, sede);
    await registrarEquipo(token, sede);

    const res = await reporte(token);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /^attachment; filename="reporte-auditoria-prueba-s-a-s-\d{4}-\d{2}-\d{2}\.pdf"$/);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    assert.ok(res.body.length > 5000);
  });

  test('se filtra por sede y rango de fechas', async () => {
    const empresa = await registrarEmpresa();
    const planta = await crearSede(empresa.token, 'Planta');
    await crearSede(empresa.token, 'Bodega');
    await aprobarPlan(empresa.token, planta);
    await registrarSimulacro(empresa.token, planta, { fecha: '2026-02-10' });
    await registrarSimulacro(empresa.token, planta, { fecha: '2025-06-01' });

    const res = await reporte(empresa.token, `?sedeId=${planta}&desde=2026-01-01&hasta=${HOY}&secciones=plan,simulacros`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /-planta-/);

    // Lo que entra al PDF: solo la sede elegida y los simulacros del periodo.
    const { rows: [{ id_empresa: empresaId }] } = await pool.query(
      'SELECT id_empresa FROM sede WHERE id_sede = $1',
      [planta]
    );
    const sedes = prepararSedes(await cargarDatos(pool, empresaId, planta), { desde: '2026-01-01', hasta: HOY });
    assert.equal(sedes.length, 1);
    assert.deepEqual(sedes[0].simulacrosEnPeriodo.map((s) => s.fecha), ['2026-02-10']);
    assert.equal(sedes[0].planAlCierre.numero, 1);

    // Si el periodo termina antes de aprobar el plan, no había plan vigente.
    const antes = prepararSedes(await cargarDatos(pool, empresaId, planta), { desde: '2025-01-01', hasta: '2025-12-31' });
    assert.equal(antes[0].planAlCierre, null);
    assert.deepEqual(antes[0].simulacrosEnPeriodo.map((s) => s.fecha), ['2025-06-01']);
  });

  test('valida los filtros', async () => {
    const empresa = await registrarEmpresa();
    const sede = await crearSede(empresa.token, 'Planta');

    const invertido = await reporte(empresa.token, '?desde=2026-05-01&hasta=2026-01-01');
    assert.equal(invertido.status, 400);
    const error = JSON.parse(invertido.body.toString());
    assert.ok(error.error.campos.desde);

    assert.equal((await reporte(empresa.token, `?hasta=${enDias(5)}`)).status, 400);
    assert.equal((await reporte(empresa.token, '?desde=ayer')).status, 400);
    assert.equal((await reporte(empresa.token, '?secciones=nomina')).status, 400);

    const otra = await registrarEmpresa();
    assert.equal((await reporte(otra.token, `?sedeId=${sede}`)).status, 404);
  });

  test('solo el administrador descarga el reporte', async () => {
    const { token } = await registrarEmpresa();
    const brigadista = await invitarYAceptar(token, 'brigadista');
    assert.equal((await reporte(brigadista.token)).status, 403);
    assert.equal((await api().get('/api/reportes/auditoria')).status, 401);
  });
});
