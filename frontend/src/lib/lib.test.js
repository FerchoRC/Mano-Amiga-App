// Pruebas de la lógica del frontend que no depende de pantallas: validaciones, NIT,
// vencimientos, tiempo real y avisos. Se corren con `npm test` (Vitest).
import { afterEach, describe, expect, test, vi } from 'vitest';

import { calcularDigitoVerificacion as dvBackend } from '../../../backend/src/lib/nit.js';
import { tipoEmergencia, TIPOS_EMERGENCIA } from './alertas.js';
import { nivelGlobal } from './cumplimiento.js';
import { diasParaVencer, esProximoAVencer, estaVencido } from './equipos.js';
import { iniciales, primerNombre } from './format.js';
import { calcularDigitoVerificacion, estadoNit, formatearNit } from './nit.js';
import { generarContrasena } from './password.js';
import { urlTiempoReal } from './realtimeUrl.js';
import { limpiarErrores, validarContrasena, validarCorreo, validarNombre } from './validators.js';

describe('validaciones de formularios', () => {
  test('correo', () => {
    expect(validarCorreo('')).toBe('Escribe el correo.');
    expect(validarCorreo('ana@')).toBe('Escribe un correo válido.');
    expect(validarCorreo(' ana@empresa.co ')).toBeNull();
  });

  test('nombre', () => {
    expect(validarNombre(' A ')).not.toBeNull();
    expect(validarNombre('Ana')).toBeNull();
  });

  test('contraseña con las mismas reglas del backend', () => {
    expect(validarContrasena('')).toBe('Escribe una contraseña.');
    expect(validarContrasena('corta1')).not.toBeNull();
    expect(validarContrasena('sinnumeros')).not.toBeNull();
    expect(validarContrasena('12345678')).not.toBeNull();
    expect(validarContrasena('a1'.repeat(37))).toBe('La contraseña es demasiado larga.');
    expect(validarContrasena('Segura2026')).toBeNull();
  });

  test('la contraseña generada siempre cumple las reglas', () => {
    for (let i = 0; i < 50; i++) expect(validarContrasena(generarContrasena())).toBeNull();
  });

  test('limpiarErrores deja solo los campos con mensaje', () => {
    expect(limpiarErrores({ a: null, b: 'mal', c: '' })).toEqual({ b: 'mal' });
  });
});

describe('NIT (HU-01)', () => {
  test('dígito de verificación de NIT reales', () => {
    expect(calcularDigitoVerificacion('901234567')).toBe(7);
    expect(calcularDigitoVerificacion('860002964')).toBe(4); // Bancolombia
    expect(calcularDigitoVerificacion('899999068')).toBe(1); // Ecopetrol
  });

  test('coincide con el cálculo del backend', () => {
    for (const base of ['900123456', '800197268', '830114921', '901234567', '890903938']) {
      expect(calcularDigitoVerificacion(base)).toBe(dvBackend(base));
    }
  });

  test('formato y estado mientras se escribe', () => {
    expect(formatearNit('9012345677')).toBe('901.234.567-7');
    expect(estadoNit('90123')).toBe('incompleto');
    expect(estadoNit('9012345677')).toBe('valido');
    expect(estadoNit('9012345678')).toBe('invalido');
    expect(estadoNit('0012345678')).toBe('invalido');
  });
});

describe('vencimiento de equipos (HU-11)', () => {
  afterEach(() => vi.useRealTimers());

  test('resalta los que vencen en 30 días o menos y los vencidos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T10:00:00'));
    expect(diasParaVencer('2026-12-23')).toBe(30);
    expect(esProximoAVencer('2026-12-23')).toBe(true);
    expect(esProximoAVencer('2026-12-24')).toBe(false);
    expect(esProximoAVencer('2026-11-23')).toBe(true);
    expect(estaVencido('2026-11-22')).toBe(true);
    expect(estaVencido(null)).toBe(false);
    expect(diasParaVencer(null)).toBeNull();
  });
});

describe('dirección del tiempo real (H-03)', () => {
  const local = { protocol: 'http:', host: 'localhost:5173' };
  const vercel = { protocol: 'https:', host: 'manoamiga.vercel.app' };

  test('en desarrollo usa el mismo dominio (Vite lo redirige al backend)', () => {
    expect(urlTiempoReal({}, local)).toBe('ws://localhost:5173/ws');
  });

  test('con la API en otro dominio, usa ese dominio con wss', () => {
    expect(urlTiempoReal({ apiUrl: 'https://api.manoamiga.co' }, vercel)).toBe('wss://api.manoamiga.co/ws');
    expect(urlTiempoReal({ apiUrl: 'https://api.manoamiga.co/' }, vercel)).toBe('wss://api.manoamiga.co/ws');
    expect(urlTiempoReal({ apiUrl: 'http://192.168.1.20:4000' }, local)).toBe('ws://192.168.1.20:4000/ws');
  });

  test('VITE_WS_URL tiene prioridad', () => {
    expect(urlTiempoReal({ wsUrl: 'wss://tiempo.manoamiga.co/ws', apiUrl: 'https://api.manoamiga.co' }, vercel)).toBe(
      'wss://tiempo.manoamiga.co/ws'
    );
  });
});

describe('alertas y cumplimiento', () => {
  test('los tipos de emergencia son los que acepta el backend', () => {
    // Misma lista que TIPOS_EMERGENCIA en backend/src/routes/alertas.routes.js.
    const ids = TIPOS_EMERGENCIA.map((t) => t.id).sort();
    expect(ids).toEqual(['amenaza', 'evacuacion', 'incendio', 'inundacion', 'medica', 'otra', 'sismo']);
    for (const id of ids) expect(tipoEmergencia(id).etiqueta).toBeTruthy();
  });

  test('nivel global del panel (HU-13)', () => {
    expect(nivelGlobal(100).estado).toBe('verde');
    expect(nivelGlobal(85).estado).toBe('verde');
    expect(nivelGlobal(84).estado).toBe('amarillo');
    expect(nivelGlobal(60).estado).toBe('amarillo');
    expect(nivelGlobal(59).estado).toBe('rojo');
  });

  test('nombres para mostrar', () => {
    expect(primerNombre('  Ana María Torres ')).toBe('Ana');
    expect(iniciales('Ana Torres')).toBe('AT');
  });
});
