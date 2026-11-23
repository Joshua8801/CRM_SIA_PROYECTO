import { Request, Response, NextFunction } from 'express';
import { obtenerResumenDashboardData } from '../services/dashboard.service';

export async function obtenerResumenDashboard(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await obtenerResumenDashboardData();
    res.json(data);
  } catch (error) {
    next(error);
  }
}
