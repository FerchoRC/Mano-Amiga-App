import { env } from '../config/env.js';
import { generateToken, hashToken } from '../lib/tokens.js';

// Crea o reemplaza la invitación del usuario y devuelve el enlace para aceptarla.
export async function issueInvitation(db, idUsuario) {
  const token = generateToken();
  const {
    rows: [invitacion],
  } = await db.query(
    `INSERT INTO invitacion (id_usuario, token_hash, expira_en)
     VALUES ($1, $2, now() + make_interval(days => $3))
     ON CONFLICT (id_usuario)
     DO UPDATE SET token_hash = EXCLUDED.token_hash,
                   expira_en  = EXCLUDED.expira_en,
                   creado_en  = now()
     RETURNING expira_en`,
    [idUsuario, hashToken(token), env.invitationDays]
  );

  return { enlace: `${env.appUrl}/invitacion/${token}`, expiraEn: invitacion.expira_en };
}
