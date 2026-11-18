import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { loginUsuario, obtenerPerfilUsuario } from '../services/auth.service';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Debe ingresar correo y contraseña.' });
      return;
    }
    const data = await loginUsuario(email, password);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const usuario = await obtenerPerfilUsuario(req.user!.id_usuario);
    res.json({ usuario });
  } catch (error) {
    next(error);
  }
}
