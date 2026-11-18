import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Catalogos, Usuario } from '../types';

interface AuthContextValue {
  usuario: Usuario | null;
  catalogos: Catalogos | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('crm_t3_user');
    return saved ? (JSON.parse(saved) as Usuario) : null;
  });
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarCatalogos = async () => {
    try {
      const { data } = await api.get<Catalogos>('/catalogos');
      setCatalogos(data);
    } catch {
      // Manejado por interceptor si es 401
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('crm_t3_token');
    if (token) {
      cargarCatalogos().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; usuario: Usuario }>(
      '/auth/login',
      { email, password }
    );
    localStorage.setItem('crm_t3_token', data.token);
    localStorage.setItem('crm_t3_user', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    await cargarCatalogos();
  };

  const logout = () => {
    localStorage.removeItem('crm_t3_token');
    localStorage.removeItem('crm_t3_user');
    setUsuario(null);
    setCatalogos(null);
  };

  return (
    <AuthContext.Provider
      value={{ usuario, catalogos, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
