import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  Scale,
  AlertTriangle,
  MessageSquare,
  LogOut,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navGroups = [
  { label: '', items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Ingresos',
    items: [
      { path: '/clientes', label: 'Clientes y Crédito', icon: Users },
      { path: '/cuentas', view: 'movimientos', label: 'Registro de movimientos', icon: Wallet },
    ],
  },
  {
    label: 'Reportes',
    items: [{ path: '/cuentas', view: 'estado', label: 'Estado de cuenta', icon: FileText }],
  },
  {
    label: 'Procesos',
    items: [
      { path: '/alertas', label: 'Alertas de Crédito', icon: AlertTriangle },
      { path: '/interacciones', label: 'Interacciones', icon: MessageSquare },
      { path: '/conciliacion', label: 'Conciliación', icon: Scale },
    ],
  },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const vista = new URLSearchParams(search).get('vista') === 'estado' ? 'estado' : 'movimientos';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Barra lateral */}
      <aside className="no-print w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">CRM Cuentas T3</h1>
            <p className="text-xs text-slate-400">Gestión de Crédito</p>
          </div>
        </div>

        <nav aria-label="Menú principal" className="flex-1 space-y-5 px-3 py-4">
          {navGroups.map(({ label: group, items }) => (
            <div key={group} className="space-y-1">
              {group && (
                <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group}
                </h2>
              )}
              {items.map(({ path, view, label, icon: Icon }) => {
                const matchesPath = pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
                const active = matchesPath && (!view || view === vista);
                return (
                  <Link
                    key={label}
                    to={view ? path + '?vista=' + view : path}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">
              {usuario?.nombre_completo}
            </p>
            <p className="text-xs text-slate-400">
              {usuario?.rol} · {usuario?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
