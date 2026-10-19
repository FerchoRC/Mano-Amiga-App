import { notFound } from '../lib/errors.js';
import { uuidSchema } from '../lib/validation.js';

// Datos de la sede más un resumen del estado de su plan de emergencias.
const SELECT_SEDE = `
  SELECT s.*,
         p.id_plan IS NOT NULL AS tiene_plan,
         vigente.numero        AS version_vigente,
         vigente.aprobado_en   AS aprobado_en,
         EXISTS (SELECT 1 FROM plan_version b
                  WHERE b.id_plan = p.id_plan AND b.estado = 'borrador') AS tiene_borrador
    FROM sede s
    LEFT JOIN plan_emergencia p ON p.id_sede = s.id_sede
    LEFT JOIN LATERAL (
      SELECT v.numero, v.aprobado_en
        FROM plan_version v
       WHERE v.id_plan = p.id_plan AND v.estado = 'aprobado'
       ORDER BY v.numero DESC
       LIMIT 1
    ) vigente ON true`;

// 'sin_plan' | 'borrador' (aún no hay versión aprobada) | 'aprobado'
function estadoPlan(row) {
  if (row.version_vigente) return 'aprobado';
  return row.tiene_plan ? 'borrador' : 'sin_plan';
}

export function toSedeDto(row, { verBorradores = false } = {}) {
  const estado = estadoPlan(row);
  return {
    id: row.id_sede,
    nombre: row.nombre,
    direccion: row.direccion,
    ciudad: row.ciudad,
    lat: Number(row.lat),
    lng: Number(row.lng),
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    plan: {
      // Quien no gestiona planes no ve borradores: para esa persona no hay plan aún.
      estado: !verBorradores && estado === 'borrador' ? 'sin_plan' : estado,
      versionVigente: row.version_vigente,
      aprobadoEn: row.aprobado_en,
      tieneBorrador: verBorradores && row.tiene_borrador,
    },
  };
}

export async function listSedes(db, empresaId) {
  const { rows } = await db.query(
    `${SELECT_SEDE} WHERE s.id_empresa = $1 ORDER BY lower(s.nombre)`,
    [empresaId]
  );
  return rows;
}

// Solo encuentra sedes de la empresa de quien hace la petición.
export async function findSede(db, empresaId, idSede) {
  if (!uuidSchema.safeParse(idSede).success) throw notFound('No encontramos esa sede.');
  const { rows } = await db.query(`${SELECT_SEDE} WHERE s.id_empresa = $1 AND s.id_sede = $2`, [
    empresaId,
    idSede,
  ]);
  if (!rows[0]) throw notFound('No encontramos esa sede.');
  return rows[0];
}
