// Crea (o recrea) una empresa de demostración con un usuario por rol.
import { pathToFileURL } from 'node:url';

import { pool, withTransaction } from '../config/db.js';
import { calcularDigitoVerificacion } from '../lib/nit.js';
import { hashPassword } from '../lib/passwords.js';
import { limpiarContenido, plantillaPlan } from '../lib/plan.js';
import { issueInvitation } from '../services/invitations.js';
import { migrate } from './migrate.js';

const NIT_DEMO = '901234567';
export const CONTRASENA_DEMO = 'ManoAmiga2026';

const USUARIOS = [
  { nombre: 'Ana Torres', correo: 'admin@demo.co', rol: 'administrador' },
  { nombre: 'Carlos Mejía', correo: 'brigadista@demo.co', rol: 'brigadista' },
  { nombre: 'Sofía Gómez', correo: 'empleado@demo.co', rol: 'empleado' },
  { nombre: 'Marta Cano', correo: 'marta@demo.co', rol: 'empleado', activo: false },
  { nombre: 'Laura Gómez', correo: 'laura@demo.co', rol: 'brigadista' },
  { nombre: 'Diego Vélez', correo: 'diego@demo.co', rol: 'brigadista' },
];

// HU-06: Carlos está en dos brigadas; la Planta aún no tiene brigada contra incendios.
const BRIGADAS = {
  'Planta Itagüí': [
    { tipo: 'primeros_auxilios', lider: 'laura@demo.co', miembros: ['laura@demo.co', 'brigadista@demo.co'] },
    { tipo: 'evacuacion', lider: 'brigadista@demo.co', miembros: ['brigadista@demo.co', 'diego@demo.co'] },
  ],
  'Bodega Sabaneta': [
    { tipo: 'evacuacion', lider: 'diego@demo.co', miembros: ['diego@demo.co', 'laura@demo.co'] },
  ],
};

// HU-07: puntos y rutas de evacuación alrededor de cada sede (coordenadas de demostración).
const MAPAS = {
  'Planta Itagüí': {
    puntos: [
      { tipo: 'punto_encuentro', nombre: 'Parqueadero de visitantes', descripcion: 'Frente a la portería principal. Repórtate con el brigadista de evacuación.', lat: 6.17545, lng: -75.6047 },
      { tipo: 'extintor', nombre: 'Extintor EXT-01 · Recepción', descripcion: 'Multipropósito ABC de 10 lb, junto a la puerta de entrada.', lat: 6.17522, lng: -75.60528 },
      { tipo: 'extintor', nombre: 'Extintor EXT-02 · Bodega', descripcion: 'Multipropósito ABC de 20 lb, al lado del portón de carga.', lat: 6.17506, lng: -75.60546 },
      { tipo: 'botiquin', nombre: 'Botiquín · Enfermería', descripcion: 'Primer piso, oficina de talento humano.', lat: 6.17516, lng: -75.60505 },
      { tipo: 'camilla', nombre: 'Camilla rígida', descripcion: 'Pasillo central, junto al botiquín.', lat: 6.1751, lng: -75.60498 },
    ],
    rutas: [
      { nombre: 'Ruta principal', descripcion: 'Desde la recepción por el andén peatonal hasta el parqueadero.', origen: 'Recepción', destino: 'Parqueadero de visitantes', trazado: [[6.17518, -75.60528], [6.17526, -75.60512], [6.17536, -75.60492], [6.17545, -75.6047]] },
      { nombre: 'Salida de la bodega', descripcion: 'Por el portón de carga, bordeando el edificio.', origen: 'Bodega', destino: 'Parqueadero de visitantes', trazado: [[6.17504, -75.60548], [6.1752, -75.6054], [6.17532, -75.60504], [6.17545, -75.6047]] },
    ],
  },
  'Bodega Sabaneta': {
    puntos: [
      { tipo: 'punto_encuentro', nombre: 'Zona verde lateral', descripcion: 'Costado oriental de la bodega, lejos de los muelles de carga.', lat: 6.15195, lng: -75.61655 },
      { tipo: 'extintor', nombre: 'Extintor EXT-01 · Muelle', descripcion: 'Junto al muelle de carga 1.', lat: 6.15172, lng: -75.61695 },
      { tipo: 'botiquin', nombre: 'Botiquín · Portería', descripcion: 'Dentro de la portería.', lat: 6.15164, lng: -75.61706 },
    ],
    rutas: [
      { nombre: 'Salida oriental', descripcion: 'Por la puerta peatonal hacia la zona verde.', origen: 'Bodega', destino: 'Zona verde lateral', trazado: [[6.15168, -75.61702], [6.1518, -75.6168], [6.15195, -75.61655]] },
    ],
  },
};

const SEDES = [
  {
    nombre: 'Planta Itagüí',
    direccion: 'Calle 50 # 41-20, Zona Industrial',
    ciudad: 'Itagüí',
    lat: 6.1752,
    lng: -75.6052,
    plan: 'aprobado',
    puntoEncuentro: 'Parqueadero de visitantes, frente a la portería principal.',
  },
  {
    nombre: 'Bodega Sabaneta',
    direccion: 'Carrera 45 # 70 Sur-50',
    ciudad: 'Sabaneta',
    lat: 6.1517,
    lng: -75.617,
    plan: 'borrador',
    puntoEncuentro: '',
  },
  {
    nombre: 'Oficina El Poblado',
    direccion: 'Calle 10 # 43D-25, piso 6',
    ciudad: 'Medellín',
    lat: 6.2092,
    lng: -75.5671,
  },
];

async function seed() {
  await migrate();
  const hash = await hashPassword(CONTRASENA_DEMO);

  const enlace = await withTransaction(async (db) => {
    await db.query('DELETE FROM empresa WHERE nit = $1', [NIT_DEMO]);

    const {
      rows: [empresa],
    } = await db.query(
      `INSERT INTO empresa (nit, digito_verificacion, razon_social, sector, num_empleados)
       VALUES ($1, $2, 'Textiles del Aburrá S.A.S.', 'Manufactura', 86)
       RETURNING id_empresa`,
      [NIT_DEMO, calcularDigitoVerificacion(NIT_DEMO)]
    );

    let idAdmin;
    const idPorCorreo = {};
    for (const u of USUARIOS) {
      const {
        rows: [creado],
      } = await db.query(
        `INSERT INTO usuario (id_empresa, nombre, correo, contrasena_hash, rol, activo, invitado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id_usuario`,
        [empresa.id_empresa, u.nombre, u.correo, hash, u.rol, u.activo ?? true, idAdmin ?? null]
      );
      idAdmin ??= creado.id_usuario;
      idPorCorreo[u.correo] = creado.id_usuario;
    }

    // Tres sedes: una con plan aprobado, otra con plan en borrador y otra sin plan.
    for (const sede of SEDES) {
      const {
        rows: [creada],
      } = await db.query(
        `INSERT INTO sede (id_empresa, nombre, direccion, ciudad, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_sede`,
        [empresa.id_empresa, sede.nombre, sede.direccion, sede.ciudad, sede.lat, sede.lng]
      );

      for (const b of BRIGADAS[sede.nombre] ?? []) {
        const {
          rows: [brigada],
        } = await db.query(
          'INSERT INTO brigada (id_sede, tipo, id_lider) VALUES ($1, $2, $3) RETURNING id_brigada',
          [creada.id_sede, b.tipo, idPorCorreo[b.lider]]
        );
        await db.query('INSERT INTO brigada_usuario (id_brigada, id_usuario) SELECT $1, unnest($2::uuid[])', [
          brigada.id_brigada,
          b.miembros.map((correo) => idPorCorreo[correo]),
        ]);
      }

      const mapa = MAPAS[sede.nombre];
      for (const p of mapa?.puntos ?? []) {
        await db.query(
          `INSERT INTO mapa_punto (id_sede, tipo, nombre, descripcion, lat, lng)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [creada.id_sede, p.tipo, p.nombre, p.descripcion, p.lat, p.lng]
        );
      }
      for (const r of mapa?.rutas ?? []) {
        await db.query(
          `INSERT INTO mapa_ruta (id_sede, nombre, descripcion, origen, destino, trazado)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [creada.id_sede, r.nombre, r.descripcion, r.origen, r.destino, JSON.stringify(r.trazado)]
        );
      }

      if (!sede.plan) continue;

      const {
        rows: [plan],
      } = await db.query(
        'INSERT INTO plan_emergencia (id_sede, creado_por) VALUES ($1, $2) RETURNING id_plan',
        [creada.id_sede, idAdmin]
      );
      const contenido = plantillaPlan();
      contenido.puntosEncuentro[0].referencia = sede.puntoEncuentro;
      const aprobado = sede.plan === 'aprobado';
      await db.query(
        `INSERT INTO plan_version
           (id_plan, numero, estado, contenido, creado_por, actualizado_por, aprobado_por, aprobado_en)
         VALUES ($1, 1, $2, $3, $4, $4, $5, $6)`,
        [
          plan.id_plan,
          sede.plan,
          aprobado ? limpiarContenido(contenido) : contenido,
          idAdmin,
          aprobado ? idAdmin : null,
          aprobado ? new Date() : null,
        ]
      );
    }

    // Una invitación pendiente para ver ese estado en la tabla de usuarios.
    const {
      rows: [pendiente],
    } = await db.query(
      `INSERT INTO usuario (id_empresa, nombre, correo, rol, invitado_por)
       VALUES ($1, 'Julián Restrepo', 'julian@demo.co', 'brigadista', $2)
       RETURNING id_usuario`,
      [empresa.id_empresa, idAdmin]
    );
    return (await issueInvitation(db, pendiente.id_usuario)).enlace;
  });

  console.log('✔ Empresa demo creada: Textiles del Aburrá S.A.S.');
  console.log(`  Contraseña de todos los usuarios: ${CONTRASENA_DEMO}`);
  for (const u of USUARIOS) console.log(`  · ${u.rol.padEnd(13)} ${u.correo}${u.activo === false ? ' (inactivo)' : ''}`);
  console.log(`  · sedes: ${SEDES.map((s) => `${s.nombre} (${s.plan ?? 'sin plan'})`).join(', ')}`);
  console.log(`  · invitación pendiente: ${enlace}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seed();
  } catch (error) {
    console.error('✖ No se pudo crear la empresa demo:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
