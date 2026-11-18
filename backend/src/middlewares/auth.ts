import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload, RolUsuario } from '../types';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('La variable de entorno JWT_SECRET es obligatoria.');
  }
  return secret;
};

/**
 * Verifica el token Bearer JWT y adjunta el usuario autenticado a req.user.
 */
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticación requerido.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

/**
 * Restringe el acceso según los roles permitidos.
 */
export function authorizeRoles(...roles: RolUsuario[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Usuario no autenticado.' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
      return;
    }
    next();
  };
}
