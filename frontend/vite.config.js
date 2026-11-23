import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `npm run preview` usa las mismas cabeceras de seguridad que Vercel (vercel.json),
// para probar la versión de producción con la política de contenido aplicada.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const cabecerasProduccion = Object.fromEntries(
  vercel.headers.flatMap((regla) => regla.headers).map(({ key, value }) => [key, value])
);

const proxy = {
  '/api': 'http://localhost:4000',
  '/ws': { target: 'ws://localhost:4000', ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy, headers: cabecerasProduccion },
});
