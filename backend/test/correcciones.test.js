// Pruebas de las correcciones de la auditoría del 23 de noviembre de 2026:
// datos sin HTML, consentimiento de datos, recuperación de contraseña, rutas de
// evacuación, límite de intentos, limpieza, cuerpos grandes y arranque en producción.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  api,
  auth,
  CONTRASENA,
  correoAleatorio,
  invitarYAceptar,
  pool,
  registrarEmpresa,
  usarBaseDePruebas,
} from './helpers.js';

const { generateToken, hashToken } = await import('../src/lib/tokens.js');
const { VERSION_POLITICA } = await import('../src/services/consentimiento.js');
const { PostgresStore } = await import('../src/middleware/rateLimit.js');
const { limpiarRegistrosVencidos } = await import('../src/services/limpieza.js');

usarBaseDePruebas();

const crearSede = (token, nombre = 'Planta') =>
  api()
    .post('/api/sedes')
    .set(...auth(token))
    .send({ nombre, direccion: 'Calle 50 # 41-20', ciudad: 'Itagüí', lat: 6.1752, lng: -75.6052 });

const idDe = async (correo) =>
  (await pool.query('SELECT id_usuario FROM usuario WHERE lower(correo) = lower($1)', [correo])).rows[0]
    .id_usuario;

describe('H-01 · Los nombres no aceptan HTML', () => {
  test('se rechazan < y > en sedes, puntos, rutas, equipos y personas', async () => {
    const { token } = await registrarEmpresa();
    const malo = '<img src=x onerror=alert(1)>';

    const sede = await crearSede(token, malo);
    assert.equal(sede.status, 400);
    assert.ok(sede.body.error.campos.nombre);

    const sedeId = (await crearSede(token)).body.sede.id;
    const punto = await api()
      .post(`/api/sedes/${sedeId}/mapa/puntos`)
      .set(...auth(token))
      .send({ tipo: 'extintor', nombre: malo, lat: 6.17, lng: -75.6 });
    assert.equal(punto.status, 400);

    const ruta = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(token))
      .send({ nombre: malo, trazado: [[6.17, -75.6], [6.18, -75.61]] });
    assert.equal(ruta.status, 400);

    const equipo = await api()
      .post(`/api/sedes/${sedeId}/equipos`)
      .set(...auth(token))
      .send({ tipo: 'extintor', nombre: 'EXT-1', ubicacion: malo, fechaVencimiento: null, estado: 'operativo' });
    assert.equal(equipo.status, 400);

    const persona = await api()
      .post('/api/usuarios/invitaciones')
      .set(...auth(token))
      .send({ nombre: malo, correo: correoAleatorio('x'), rol: 'empleado' });
    assert.equal(persona.status, 400);

    // Un nombre normal con tildes y símbolos comunes sigue funcionando.
    const normal = await api()
      .post(`/api/sedes/${sedeId}/mapa/puntos`)
      .set(...auth(token))
      .send({ tipo: 'extintor', nombre: 'Extintor #2 · Cocina (piso 1) & bodega', lat: 6.17, lng: -75.6 });
    assert.equal(normal.status, 201);
  });
});

describe('H-05 · Consentimiento de datos (Ley 1581)', () => {
  test('el registro guarda la aceptación con su versión', async () => {
    const { correo, res } = await registrarEmpresa();
    assert.equal(res.body.usuario.consentimientoPendiente, false);
    const { rows } = await pool.query(
      'SELECT version_politica, aceptado_en FROM consentimiento_datos WHERE id_usuario = $1',
      [await idDe(correo)]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].version_politica, VERSION_POLITICA);
    assert.ok(rows[0].aceptado_en);
  });

  test('aceptar una invitación exige aceptar la política', async () => {
    const { token } = await registrarEmpresa();
    const correo = correoAleatorio('inv');
    const inv = await api()
      .post('/api/usuarios/invitaciones')
      .set(...auth(token))
      .send({ nombre: 'Invitada', correo, rol: 'empleado' });
    const tokenInv = inv.body.enlace.split('/invitacion/')[1];

    const sin = await api()
      .post(`/api/invitaciones/${tokenInv}/aceptar`)
      .send({ nombre: 'Invitada', contrasena: CONTRASENA });
    assert.equal(sin.status, 400);
    assert.ok(sin.body.error.campos.aceptaTratamientoDatos);

    const con = await api()
      .post(`/api/invitaciones/${tokenInv}/aceptar`)
      .send({ nombre: 'Invitada', contrasena: CONTRASENA, aceptaTratamientoDatos: true });
    assert.equal(con.status, 201);
    assert.equal(con.body.usuario.consentimientoPendiente, false);
  });

  test('si cambia la política, todos deben aceptarla de nuevo', async () => {
    const { token, correo } = await registrarEmpresa();
    await pool.query("UPDATE consentimiento_datos SET version_politica = '2000-01-01' WHERE id_usuario = $1", [
      await idDe(correo),
    ]);
    const bloqueado = await api().get('/api/sedes').set(...auth(token));
    assert.equal(bloqueado.status, 403);
    assert.equal(bloqueado.body.error.codigo, 'CONSENTIMIENTO_REQUERIDO');
    // Puede ver su sesión para saber qué le falta.
    const sesion = await api().get('/api/auth/sesion').set(...auth(token));
    assert.equal(sesion.body.usuario.consentimientoPendiente, true);

    assert.equal((await api().post('/api/auth/consentimiento').set(...auth(token)).send({})).status, 400);
    await api().post('/api/auth/consentimiento').set(...auth(token)).send({ acepta: true });
    assert.equal((await api().get('/api/sedes').set(...auth(token))).status, 200);
  });
});

describe('H-06 · Recuperar la contraseña', () => {
  test('la respuesta es igual exista o no el correo, y solo se crea el enlace si existe', async () => {
    const { correo } = await registrarEmpresa();
    const existe = await api().post('/api/auth/recuperar').send({ correo });
    const noExiste = await api().post('/api/auth/recuperar').send({ correo: correoAleatorio('nadie') });
    assert.equal(existe.status, 202);
    assert.equal(noExiste.status, 202);
    assert.deepEqual(existe.body, noExiste.body);

    const { rows } = await pool.query('SELECT 1 FROM recuperacion WHERE id_usuario = $1', [await idDe(correo)]);
    assert.equal(rows.length, 1);

    // Pedir otro enlace invalida el anterior.
    await api().post('/api/auth/recuperar').send({ correo });
    const otra = await pool.query('SELECT 1 FROM recuperacion WHERE id_usuario = $1', [await idDe(correo)]);
    assert.equal(otra.rows.length, 1);
  });

  async function enlaceDePrueba(idUsuario, { vencido = false } = {}) {
    const token = generateToken();
    await pool.query(
      `INSERT INTO recuperacion (id_usuario, token_hash, expira_en)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [idUsuario, hashToken(token), vencido ? '-5' : '60']
    );
    return token;
  }

  test('el enlace crea la contraseña, cierra las sesiones y sirve una sola vez', async () => {
    const { correo, token: sesionVieja } = await registrarEmpresa();
    const enlace = await enlaceDePrueba(await idDe(correo));

    const ver = await api().get(`/api/auth/recuperar/${enlace}`);
    assert.equal(ver.status, 200);
    assert.equal(ver.body.correo, correo);

    const debil = await api().post(`/api/auth/recuperar/${enlace}`).send({ contrasena: 'corta' });
    assert.equal(debil.status, 400);

    const nueva = await api().post(`/api/auth/recuperar/${enlace}`).send({ contrasena: 'Recuperada2026' });
    assert.equal(nueva.status, 200);
    assert.ok(nueva.body.token);
    assert.equal((await api().get('/api/auth/sesion').set(...auth(sesionVieja))).status, 401);

    const login = await api().post('/api/auth/login').send({ correo, contrasena: 'Recuperada2026' });
    assert.equal(login.status, 200);

    const otraVez = await api().post(`/api/auth/recuperar/${enlace}`).send({ contrasena: 'Otra2026xx' });
    assert.equal(otraVez.status, 404);
  });

  test('un enlace vencido o de una cuenta desactivada no sirve', async () => {
    const { token, correo } = await registrarEmpresa();
    const vencido = await enlaceDePrueba(await idDe(correo), { vencido: true });
    assert.equal((await api().get(`/api/auth/recuperar/${vencido}`)).status, 410);

    const empleado = await invitarYAceptar(token, 'empleado');
    await api().patch(`/api/usuarios/${empleado.id}`).set(...auth(token)).send({ activo: false });
    await api().post('/api/auth/recuperar').send({ correo: empleado.correo });
    const { rows } = await pool.query('SELECT 1 FROM recuperacion WHERE id_usuario = $1', [empleado.id]);
    assert.equal(rows.length, 0);
    const enlace = await enlaceDePrueba(empleado.id);
    assert.equal((await api().get(`/api/auth/recuperar/${enlace}`)).status, 404);
  });
});

describe('H-04 · Rutas de evacuación desde la app', () => {
  test('el administrador traza, edita y borra una ruta', async () => {
    const { token } = await registrarEmpresa();
    const sedeId = (await crearSede(token)).body.sede.id;
    const trazado = [[6.1752, -75.6052], [6.1755, -75.6049], [6.1758, -75.6045]];

    const creada = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(token))
      .send({ nombre: 'Ruta norte', origen: 'Producción', destino: 'Parqueadero', trazado });
    assert.equal(creada.status, 201, JSON.stringify(creada.body));
    assert.deepEqual(creada.body.ruta.trazado, trazado);

    const mapa = await api().get(`/api/sedes/${sedeId}/mapa`).set(...auth(token));
    assert.equal(mapa.body.rutas.length, 1);

    const editada = await api()
      .put(`/api/sedes/${sedeId}/mapa/rutas/${creada.body.ruta.id}`)
      .set(...auth(token))
      .send({ nombre: 'Ruta norte (alterna)' });
    assert.equal(editada.status, 200);
    assert.equal(editada.body.ruta.nombre, 'Ruta norte (alterna)');
    assert.deepEqual(editada.body.ruta.trazado, trazado);

    const borrada = await api()
      .delete(`/api/sedes/${sedeId}/mapa/rutas/${creada.body.ruta.id}`)
      .set(...auth(token));
    assert.equal(borrada.status, 204);
  });

  test('valida el trazado y protege la ruta', async () => {
    const empresa = await registrarEmpresa();
    const sedeId = (await crearSede(empresa.token)).body.sede.id;

    const unPunto = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(empresa.token))
      .send({ nombre: 'Corta', trazado: [[6.17, -75.6]] });
    assert.equal(unPunto.status, 400);
    assert.ok(unPunto.body.error.campos.trazado);

    const fuera = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(empresa.token))
      .send({ nombre: 'Fuera', trazado: [[95, -75.6], [6.18, -75.61]] });
    assert.equal(fuera.status, 400);

    const empleado = await invitarYAceptar(empresa.token, 'empleado');
    const sinPermiso = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(empleado.token))
      .send({ nombre: 'Ruta', trazado: [[6.17, -75.6], [6.18, -75.61]] });
    assert.equal(sinPermiso.status, 403);

    const otra = await registrarEmpresa();
    const ajena = await api()
      .post(`/api/sedes/${sedeId}/mapa/rutas`)
      .set(...auth(otra.token))
      .send({ nombre: 'Ruta', trazado: [[6.17, -75.6], [6.18, -75.61]] });
    assert.equal(ajena.status, 404);
  });
});

describe('Operación del servidor', () => {
  test('H-08 · un cuerpo demasiado grande responde 413', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ correo: 'a@b.co', contrasena: 'x'.repeat(200_000) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.error.codigo, 'CUERPO_DEMASIADO_GRANDE');
  });

  test('H-19 · el contador de intentos vive en la base y reinicia al vencer', async () => {
    const store = new PostgresStore(`prueba-${Date.now()}`);
    store.init({ windowMs: 60_000 });
    assert.equal((await store.increment('1.2.3.4|a@b.co')).totalHits, 1);
    assert.equal((await store.increment('1.2.3.4|a@b.co')).totalHits, 2);
    await store.decrement('1.2.3.4|a@b.co');
    assert.equal((await store.increment('1.2.3.4|a@b.co')).totalHits, 2);

    await pool.query("UPDATE limite_intentos SET reinicia_en = now() - interval '1 second' WHERE clave = $1", [
      store.clave('1.2.3.4|a@b.co'),
    ]);
    assert.equal((await store.increment('1.2.3.4|a@b.co')).totalHits, 1);
    await store.resetKey('1.2.3.4|a@b.co');
    const { rows } = await pool.query('SELECT 1 FROM limite_intentos WHERE clave = $1', [store.clave('1.2.3.4|a@b.co')]);
    assert.equal(rows.length, 0);
  });

  test('H-22 · se borran las sesiones viejas y se conservan las vigentes', async () => {
    const { correo, token } = await registrarEmpresa();
    const id = await idDe(correo);
    await pool.query(
      `INSERT INTO sesion (id_usuario, token_hash, creado_en, ultima_actividad, cerrada_en)
       VALUES ($1, $2, now() - interval '40 days', now() - interval '40 days', now() - interval '40 days')`,
      [id, hashToken(generateToken())]
    );
    const resultado = await limpiarRegistrosVencidos();
    assert.ok(resultado.sesiones >= 1);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM sesion WHERE id_usuario = $1', [id]);
    assert.equal(rows[0].n, 1);
    assert.equal((await api().get('/api/auth/sesion').set(...auth(token))).status, 200);
  });

  // Se corre en un proceso aparte, desde una carpeta sin .env, para ver cómo arranca.
  const ejecutar = (codigo, variables) =>
    spawnSync(process.execPath, ['--input-type=module', '-e', codigo], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...variables },
      encoding: 'utf8',
      timeout: 20_000,
    });
  const ENV_JS = new URL('../src/config/env.js', import.meta.url).href;
  const SEED_JS = new URL('../src/db/seed.js', import.meta.url).href;

  test('H-10 · en producción no arranca sin DATABASE_URL ni APP_URL', () => {
    const r = ejecutar(`await import(${JSON.stringify(ENV_JS)});`, { NODE_ENV: 'production' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /DATABASE_URL, APP_URL/);

    const ok = ejecutar(`await import(${JSON.stringify(ENV_JS)}); console.log('ok');`, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://x:y@localhost:1/z',
      APP_URL: 'https://app.ejemplo.co',
    });
    assert.equal(ok.status, 0, ok.stderr);
  });

  test('H-21 · el seed de demostración no corre en producción', () => {
    const r = ejecutar(`process.argv[1] = ${JSON.stringify(fileURLToPath(SEED_JS))}; await import(${JSON.stringify(SEED_JS)});`, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://x:y@localhost:1/z',
      APP_URL: 'https://app.ejemplo.co',
    });
    assert.match(r.stderr, /no se puede correr en producción/);
  });
});
