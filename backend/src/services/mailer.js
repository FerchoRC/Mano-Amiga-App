import { env } from '../config/env.js';

// Correos con Resend. Sin RESEND_API_KEY no se envía nada: en desarrollo el contenido
// se muestra en la consola para poder probar los enlaces; en producción no se registra,
// porque los enlaces de invitación y recuperación funcionan como una contraseña.

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

// Marco común de los correos: franja de marca, título y cuerpo.
function marco({ cuerpo, boton, pie, colorBoton = '#2F6FDE' }) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2B2F36">
    <div style="height:4px;background:linear-gradient(90deg,#D7263D 20%,#16325C 20%)"></div>
    <div style="padding:32px 24px">
      <p style="font-size:20px;font-weight:600;color:#16325C;margin:0 0 16px">ManoAmiga</p>
      ${cuerpo}
      ${
        boton
          ? `<a href="${escapeHtml(boton.enlace)}"
         style="display:inline-block;background:${colorBoton};color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(boton.texto)}</a>`
          : ''
      }
      ${pie ? `<p style="margin:24px 0 0;font-size:13px;color:#6B7280">${pie}</p>` : ''}
    </div>
  </div>`;
}

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

  const html = marco({
    cuerpo: `
      <p style="margin:0 0 12px">Hola, ${escapeHtml(nombre)}:</p>
      <p style="margin:0 0 24px;line-height:1.5">
        ${escapeHtml(invitadoPor)} te invitó a unirte a <strong>${escapeHtml(empresa)}</strong>
        como <strong>${escapeHtml(rolTexto)}</strong>.
      </p>`,
    boton: { enlace, texto: 'Crear mi contraseña' },
    pie: `El enlace vence en ${dias} días.`,
  });

  return { subject: `Te invitaron a ${empresa} en ManoAmiga`, text, html };
}

function plantillaRecuperacion({ nombre, enlace }) {
  const text = [
    `Hola, ${nombre}:`,
    '',
    'Pediste crear una nueva contraseña para ManoAmiga.',
    `Créala aquí: ${enlace}`,
    '',
    'El enlace vence en una hora y sirve una sola vez. Si no lo pediste, ignora este correo:',
    'tu contraseña actual sigue funcionando.',
  ].join('\n');

  const html = marco({
    cuerpo: `
      <p style="margin:0 0 12px">Hola, ${escapeHtml(nombre)}:</p>
      <p style="margin:0 0 24px;line-height:1.5">Pediste crear una nueva contraseña para ManoAmiga.</p>`,
    boton: { enlace, texto: 'Crear una nueva contraseña' },
    pie: 'El enlace vence en una hora y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña actual sigue funcionando.',
  });

  return { subject: 'Crea una nueva contraseña en ManoAmiga', text, html };
}

function plantillaAlerta({ nombre, tipo, sede, instrucciones, enlace }) {
  const text = [
    `EMERGENCIA ACTIVA: ${tipo} en ${sede}`,
    '',
    `Hola, ${nombre}:`,
    instrucciones,
    '',
    `Confirma cómo estás: ${enlace}`,
  ].join('\n');

  const html = marco({
    cuerpo: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.06em;color:#D7263D">EMERGENCIA ACTIVA</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#16325C">${escapeHtml(tipo)} · ${escapeHtml(sede)}</p>
      <p style="margin:0 0 24px;line-height:1.5">${escapeHtml(instrucciones)}</p>`,
    boton: { enlace, texto: 'Confirmar cómo estoy' },
    colorBoton: '#D7263D',
    pie: 'Recibes este correo porque perteneces a esta sede en ManoAmiga.',
  });

  return { subject: `Emergencia: ${tipo} en ${sede}`, text, html };
}

// Devuelve true si el correo salió.
async function enviar({ para, correo, etiqueta, enlaceDesarrollo }) {
  if (!env.resendApiKey) {
    if (!env.isProduction && !env.isTest) {
      console.info(`[correo] ${etiqueta} para ${para}${enlaceDesarrollo ? `: ${enlaceDesarrollo}` : ''}`);
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
      console.error(`[correo] Resend respondió ${res.status} (${etiqueta}):`, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[correo] No se pudo enviar (${etiqueta}):`, error.message);
    return false;
  }
}

// Sin clave, el administrador comparte el enlace de invitación desde la plataforma.
export function enviarInvitacion({ para, ...datos }) {
  return enviar({
    para,
    correo: plantillaInvitacion({ ...datos, dias: env.invitationDays }),
    etiqueta: 'Invitación',
    enlaceDesarrollo: datos.enlace,
  });
}

export function enviarRecuperacion({ para, nombre, enlace }) {
  return enviar({
    para,
    correo: plantillaRecuperacion({ nombre, enlace }),
    etiqueta: 'Recuperación de contraseña',
    enlaceDesarrollo: enlace,
  });
}

// HU-09: aviso por correo para quien no tiene la aplicación abierta en ese momento.
export function enviarAlerta({ para, ...datos }) {
  return enviar({ para, correo: plantillaAlerta(datos), etiqueta: `Alerta (${datos.tipo})` });
}
