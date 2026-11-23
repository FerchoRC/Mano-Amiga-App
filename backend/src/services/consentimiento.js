// Ley 1581 de 2012 y Decreto 1377 de 2013: antes de tratar los datos de una persona se
// necesita su autorización, y hay que poder probarla. Se guarda quién aceptó, qué versión
// de la política, cuándo y desde qué IP.

// Cambiar la versión cuando cambie el texto de la política (frontend/src/pages/PoliticaDatosPage.jsx):
// todas las personas tendrán que aceptarla de nuevo al entrar.
export const VERSION_POLITICA = '2026-11-23';

export async function registrarConsentimiento(db, idUsuario, ip = null) {
  await db.query(
    `INSERT INTO consentimiento_datos (id_usuario, version_politica, ip)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_usuario, version_politica) DO NOTHING`,
    [idUsuario, VERSION_POLITICA, ip ? String(ip).slice(0, 45) : null]
  );
}
