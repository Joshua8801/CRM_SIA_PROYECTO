import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientesPage from './pages/ClientesPage';
import CuentasPage from './pages/CuentasPage';
import CuentaDetallePage from './pages/CuentaDetallePage';
import ConciliacionPage from './pages/ConciliacionPage';
import AlertasPage from './pages/AlertasPage';
import InteraccionesPage from './pages/InteraccionesPage';
import CobranzaPage from './pages/CobranzaPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Cargando sesión...
      </div>
    );
  }
  return usuario ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="cuentas" element={<CuentasPage />} />
            <Route path="cuentas/:id" element={<CuentaDetallePage />} />
            <Route path="conciliacion" element={<ConciliacionPage />} />
            <Route path="alertas" element={<AlertasPage />} />
            <Route path="interacciones" element={<InteraccionesPage />} />
            <Route path="cobranza" element={<CobranzaPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
