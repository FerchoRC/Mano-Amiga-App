// Búsqueda de direcciones con Nominatim (OpenStreetMap).
// Su política de uso pide como máximo 1 consulta por segundo, un User-Agent que
// identifique la aplicación y no usarlo como autocompletado; por eso las
// consultas pasan por el backend, en fila y con caché.
import { env } from '../config/env.js';

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const INTERVALO_MS = 1100;
const CACHE_MS = 24 * 60 * 60 * 1000;

const cache = new Map();
let cola = Promise.resolve();
let ultimaConsulta = 0;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "Calle 10, El Poblado, Comuna 14 - El Poblado, Perímetro Urbano Medellín, …"
// → "Calle 10, El Poblado, Medellín"
function etiquetaCorta(resultado) {
  const a = resultado.address ?? {};
  const lugar = [a.road, a.house_number].filter(Boolean).join(' ') || resultado.name;
  const zona = a.neighbourhood || a.suburb || a.quarter;
  const ciudad = a.city || a.town || a.village || a.municipality || a.county;
  const limpio = ciudad?.replace(/^Perímetro Urbano\s+/i, '');
  return [lugar, zona, limpio].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
}

async function consultar(texto) {
  const espera = ultimaConsulta + INTERVALO_MS - Date.now();
  if (espera > 0) await esperar(espera);
  ultimaConsulta = Date.now();

  const url = new URL(URL_NOMINATIM);
  url.search = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    countrycodes: 'co',
    addressdetails: '1',
    limit: '5',
  });

  const res = await fetch(url, {
    headers: {
      'User-Agent': `ManoAmiga/1.0 (${env.appUrl})`,
      'Accept-Language': 'es',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`);

  const resultados = await res.json();
  return resultados.map((r) => ({
    etiqueta: etiquetaCorta(r) || r.display_name,
    detalle: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

export function buscarDireccion(texto) {
  const clave = texto.trim().toLowerCase();
  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.en < CACHE_MS) return Promise.resolve(guardado.resultados);

  const tarea = cola.then(() => consultar(texto));
  // La fila sigue aunque una consulta falle.
  cola = tarea.catch(() => {});

  return tarea.then((resultados) => {
    cache.set(clave, { en: Date.now(), resultados });
    return resultados;
  });
}
