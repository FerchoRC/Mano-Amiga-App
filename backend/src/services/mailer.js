import { env } from '../config/env.js';

const ETIQUETA_ROL = {
  administrador: 'Administrador',
  brigadista: 'Brigadista',
  empleado: 'Empleado',
};

const escapeHtml = (texto) =>
  String(texto).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

function plantillaInvitacion({ nombre, empresa, rol, enlace, invitadoPor, dias }) {
  const rolTexto = ETIQUETA_ROL[rol] ?? rol;
  const text = [
    `Hola, ${nombre}:`,
    '',
    `${invitadoPor} te invitó a unirte a ${empresa} en ManoAmiga como ${rolTexto}.`,
    `Crea tu contraseña aquí: ${enlace}`,
    '',
    `El enlace vence en ${dias} días.`,
  ].join('\n');

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2B2F36">
    <div style="height:4px;background:linear-gradient(90deg,#D7263D 20%,#16325C 20%)"></div>
    <div style="padding:32px 24px">
      <p style="font-size:20px;font-weight:600;color:#16325C;margin:0 0 16px">ManoAmiga</p>
      <p style="margin:0 0 12px">Hola, ${escapeHtml(nombre)}:</p>
      <p style="margin:0 0 24px;line-height:1.5">
        ${escapeHtml(invitadoPor)} te invitó a unirte a <strong>${escapeHtml(empresa)}</strong>
        como <strong>${escapeHtml(rolTexto)}</strong>.
      </p>
      <a href="${escapeHtml(enlace)}"
         style="display:inline-block;background:#2F6FDE;color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:8px;font-weight:600">
        Crear mi contraseña
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#6B7280">El enlace vence en ${dias} días.</p>
    </div>
  </div>`;

  return { subject: `Te invitaron a ${empresa} en ManoAmiga`, text, html };
}

// Envía la invitación con Resend. Sin RESEND_API_KEY no se envía nada y el
// administrador comparte el enlace manualmente desde la plataforma.
// Devuelve true si el correo salió.
export async function enviarInvitacion({ para, ...datos }) {
  const correo = plantillaInvitacion({ ...datos, dias: env.invitationDays });

  if (!env.resendApiKey) {
    if (!env.isProduction && !env.isTest) {
      console.info(`[correo] Invitación para ${para}: ${datos.enlace}`);
    }
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.mailFrom, to: [para], ...correo }),
    });
    if (!res.ok) {
      console.error('[correo] Resend respondió', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[correo] No se pudo enviar la invitación:', error.message);
    return false;
  }
}
