import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { pool, testDatabaseConnection } from './config/db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

const samplePoints = [
  {
    id: 1,
    name: 'Unidad Deportiva Atanasio Girardot',
    neighborhood: 'Laureles',
    city: 'Medellín',
    needs: ['agua', 'medicina', 'cobija'],
    accepts: ['agua', 'medicina', 'cobija', 'alimento', 'aseo'],
    distanceKm: 0.45,
    status: 'critico',
  },
  {
    id: 2,
    name: 'Parque de los Deseos',
    neighborhood: 'Sevilla',
    city: 'Medellín',
    needs: ['alimento', 'aseo'],
    accepts: ['alimento', 'aseo', 'ropa', 'bebe'],
    distanceKm: 1.2,
    status: 'activo',
  },
];

app.get('/api/health', async (_req, res) => {
  const dbConnected = await testDatabaseConnection();

  res.status(200).json({
    ok: true,
    service: 'mano-amiga-backend',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

app.get('/api/points', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT NOW() as current_time, $1::text as message',
      ['API de puntos de recogida activa']
    );

    res.status(200).json({
      items: samplePoints,
      dbTime: result.rows[0].current_time,
      message: result.rows[0].message,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al consultar los puntos',
      error: error.message,
    });
  }
});

app.get('/api/points/:id', async (req, res) => {
  const point = samplePoints.find((item) => item.id === Number(req.params.id));

  if (!point) {
    return res.status(404).json({ message: 'Punto no encontrado' });
  }

  return res.status(200).json(point);
});

app.listen(port, async () => {
  console.log(`🚀 API de Mano Amiga disponible en http://localhost:${port}`);
  await testDatabaseConnection();
});
