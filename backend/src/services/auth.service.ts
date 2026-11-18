import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../config/db';
import { AppError, JwtPayload, RolUsuario } from '../types';

export async function loginUsuario(email: string, password: string) {
  const result = await pool.query<{
    id_usuario: number;
    nombre_completo: string;
    email: string;
    password_hash: string;
    rol: RolUsuario;
    activo: boolean;
  }>(
    `SELECT id_usuario, nombre_completo, email, password_hash, rol, activo
     FROM mae_usuario
     WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );

  const user = result.rows[0];
  if (!user || !user.activo) {
    throw new AppError('Credenciales inválidas o usuario inactivo.', 401);
  }

  const passwordValida = await bcrypt.compare(password, user.password_hash);
  if (!passwordValida) {
    throw new AppError('Credenciales inválidas o usuario inactivo.', 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado.');
  }

  const payload: JwtPayload = {
    id_usuario: user.id_usuario,
    email: user.email,
    nombre_completo: user.nombre_completo,
    rol: user.rol,
  };

  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];
  const token = jwt.sign(payload, secret, { expiresIn });

  return {
    token,
    usuario: payload,
  };
}

export async function obtenerPerfilUsuario(idUsuario: number) {
  const result = await pool.query(
    `SELECT id_usuario, nombre_completo, email, rol, activo, fecha_creacion
     FROM mae_usuario
     WHERE id_usuario = $1`,
    [idUsuario]
  );

  if (result.rows.length === 0) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  return result.rows[0];
}
