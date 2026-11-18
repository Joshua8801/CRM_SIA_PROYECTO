import { Request } from 'express';

export type RolUsuario = 'ADMIN' | 'ANALISTA' | 'CONSULTA';

export interface JwtPayload {
  id_usuario: number;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
