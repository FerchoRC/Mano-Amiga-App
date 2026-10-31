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
];

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
