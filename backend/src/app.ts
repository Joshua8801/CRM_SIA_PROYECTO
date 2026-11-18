import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import catalogosRoutes from './routes/catalogos.routes';
import dashboardRoutes from './routes/dashboard.routes';
import clientesRoutes from './routes/clientes.routes';
import cuentasRoutes from './routes/cuentas.routes';
import movimientosRoutes from './routes/movimientos.routes';
import alertasRoutes from './routes/alertas.routes';
import interaccionesRoutes from './routes/interacciones.routes';
import conciliacionesRoutes from './routes/conciliaciones.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'crm-cuentas-corrientes-t3' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/catalogos', catalogosRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/clientes', clientesRoutes);
app.use('/api/v1/cuentas', cuentasRoutes);
app.use('/api/v1/movimientos', movimientosRoutes);
app.use('/api/v1/alertas', alertasRoutes);
app.use('/api/v1/interacciones', interaccionesRoutes);
app.use('/api/v1/conciliaciones', conciliacionesRoutes);

app.use(errorHandler);

export default app;
