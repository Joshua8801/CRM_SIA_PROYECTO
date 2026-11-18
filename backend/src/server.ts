import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/db';

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('Conexión a PostgreSQL verificada correctamente.');
    app.listen(PORT, () => {
      console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL al iniciar:', error);
    process.exit(1);
  }
}

start();
