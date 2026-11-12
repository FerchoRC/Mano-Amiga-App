import { Router } from 'express';

import { pool } from '../config/db.js';
import { PERMISOS } from '../lib/roles.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { realtime } from '../services/realtime.js';
import { findSede } from '../services/sedes.js';

// HU-09: Enviar alerta de emergencia
// HU-10: Confirmar estado en una emergencia

const router = Router();
router.use(authenticate);

// Obtener alerta activa de la sede/empresa
router.get('/activa', async (req, res) => {
  const { sedeId } = req.query;
  const empresaId = req.auth.usuario.empresaId;
  const usuarioId = req.auth.usuario.id;

  let query = `
    SELECT a.id_alerta, a.id_sede, a.tipo, a.instrucciones, a.activa, a.creado_en,
           s.nombre AS sede_nombre,
           u.nombre AS remitente_nombre,
           r.estado AS mi_estado,
           r.respondido_en AS mi_respondido_en
      FROM alerta a
      JOIN sede s ON s.id_sede = a.id_sede
      JOIN usuario u ON u.id_usuario = a.id_usuario
 LEFT JOIN alerta_respuesta r ON r.id_alerta = a.id_alerta AND r.id_usuario = $2
     WHERE a.id_empresa = $1 AND a.activa = true
  `;
  const params = [empresaId, usuarioId];

  if (sedeId) {
    query += ` AND a.id_sede = $3`;
    params.push(sedeId);
  }

  query += ` ORDER BY a.creado_en DESC LIMIT 1`;

  const { rows } = await pool.query(query, params);
  if (!rows[0]) {
    return res.json({ alerta: null });
  }

  const a = rows[0];
  res.json({
    alerta: {
      id: a.id_alerta,
      sedeId: a.id_sede,
      sedeNombre: a.sede_nombre,
      tipo: a.tipo,
      instrucciones: a.instrucciones,
      activa: a.activa,
      creadoEn: a.creado_en,
      remitenteNombre: a.remitente_nombre,
      miRespuesta: a.mi_estado ? { estado: a.mi_estado, respondidoEn: a.mi_respondido_en } : null,
    },
  });
});

// Enviar alerta (administrador o brigadista)
router.post('/', requirePermission(PERMISOS.ALERTAS_ENVIAR), async (req, res) => {
  const { sedeId, tipo, instrucciones } = req.body;
  const empresaId = req.auth.usuario.empresaId;
  const usuarioId = req.auth.usuario.id;

  if (!sedeId || !tipo || !instrucciones) {
    return res.status(400).json({
      error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Debes indicar sede, tipo de emergencia e instrucciones.' },
    });
  }

  const sede = await findSede(pool, empresaId, sedeId);

  // Desactivar alertas activas anteriores para esta sede
  await pool.query('UPDATE alerta SET activa = false WHERE id_sede = $1 AND activa = true', [sede.id_sede]);

  const { rows } = await pool.query(
    `INSERT INTO alerta (id_empresa, id_sede, id_usuario, tipo, instrucciones, activa)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id_alerta, id_sede, tipo, instrucciones, activa, creado_en`,
    [empresaId, sede.id_sede, usuarioId, tipo, instrucciones.trim()]
  );

  const a = rows[0];
  const resultado = {
    id: a.id_alerta,
    sedeId: a.id_sede,
    sedeNombre: sede.nombre,
    tipo: a.tipo,
    instrucciones: a.instrucciones,
    activa: a.activa,
    creadoEn: a.creado_en,
    remitenteNombre: req.auth.usuario.nombre,
    miRespuesta: null,
  };

  // Notificar por WebSocket a toda la empresa y a la sede
  realtime.toEmpresa(empresaId, 'alerta:nueva', { alerta: resultado });
  realtime.toSede(sede.id_sede, 'alerta:nueva', { alerta: resultado });

  res.status(201).json({ alerta: resultado });
});

// Finalizar alerta activa
router.post('/:idAlerta/finalizar', requirePermission(PERMISOS.ALERTAS_ENVIAR), async (req, res) => {
  const empresaId = req.auth.usuario.empresaId;
  const usuarioId = req.auth.usuario.id;

  const { rows } = await pool.query(
    `UPDATE alerta
        SET activa = false, finalizado_en = now(), finalizado_por = $1
      WHERE id_alerta = $2 AND id_empresa = $3
  RETURNING id_alerta, id_sede`,
    [usuarioId, req.params.idAlerta, empresaId]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: { codigo: 'ALERTA_NO_ENCONTRADA', mensaje: 'Alerta no encontrada.' } });
  }

  const a = rows[0];
  realtime.toEmpresa(empresaId, 'alerta:finalizada', { alertaId: a.id_alerta, sedeId: a.id_sede });
  realtime.toAlerta(a.id_alerta, 'alerta:finalizada', { alertaId: a.id_alerta });

  res.json({ ok: true, alertaId: a.id_alerta });
});

// HU-10: Listar respuestas y pendientes de una alerta
router.get('/:idAlerta/respuestas', async (req, res) => {
  const empresaId = req.auth.usuario.empresaId;

  const [respuestasRes, pendientesRes] = await Promise.all([
    pool.query(
      `SELECT r.id_respuesta, r.estado, r.mensaje, r.respondido_en,
              u.id_usuario, u.nombre, u.correo, u.rol
         FROM alerta_respuesta r
         JOIN usuario u ON u.id_usuario = r.id_usuario
        WHERE r.id_alerta = $1
        ORDER BY r.respondido_en DESC`,
      [req.params.idAlerta]
    ),
    pool.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.rol
         FROM usuario u
        WHERE u.id_empresa = $1 AND u.activo = true
          AND u.id_usuario NOT IN (
            SELECT r.id_usuario FROM alerta_respuesta r WHERE r.id_alerta = $2
          )
        ORDER BY lower(u.nombre)`,
      [empresaId, req.params.idAlerta]
    ),
  ]);

  res.json({
    respuestas: respuestasRes.rows.map((r) => ({
      id: r.id_respuesta,
      estado: r.estado,
      mensaje: r.mensaje,
      respondidoEn: r.respondido_en,
      usuario: { id: r.id_usuario, nombre: r.nombre, correo: r.correo, rol: r.rol },
    })),
    pendientes: pendientesRes.rows.map((u) => ({
      usuario: { id: u.id_usuario, nombre: u.nombre, correo: u.correo, rol: u.rol },
    })),
  });
});

// HU-10: Confirmar estado ("a_salvo" o "necesita_ayuda")
router.post('/:idAlerta/respuestas', async (req, res) => {
  const { estado, mensaje = '' } = req.body;
  const usuario = req.auth.usuario;

  if (!['a_salvo', 'necesita_ayuda'].includes(estado)) {
    return res.status(400).json({
      error: { codigo: 'ESTADO_INVALIDO', mensaje: 'El estado debe ser a_salvo o necesita_ayuda.' },
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO alerta_respuesta (id_alerta, id_usuario, estado, mensaje, respondido_en)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id_alerta, id_usuario)
     DO UPDATE SET estado = EXCLUDED.estado, mensaje = EXCLUDED.mensaje, respondido_en = now()
     RETURNING id_respuesta, id_alerta, id_usuario, estado, mensaje, respondido_en`,
    [req.params.idAlerta, usuario.id, estado, mensaje.trim()]
  );

  const r = rows[0];
  const payload = {
    id: r.id_respuesta,
    alertaId: r.id_alerta,
    estado: r.estado,
    mensaje: r.mensaje,
    respondidoEn: r.respondido_en,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };

  // Notificar en tiempo real mediante WebSocket
  realtime.toAlerta(r.id_alerta, 'alerta:respuesta', payload);
  realtime.toEmpresa(usuario.empresaId, 'alerta:respuesta', payload);

  res.status(201).json({ respuesta: payload });
});

export default router;
