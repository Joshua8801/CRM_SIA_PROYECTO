import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertaCredito } from '../types';
import { formatDateTime, formatMoney } from '../utils/format';

export default function AlertasPage() {
  const { usuario } = useAuth();
  const [alertas, setAlertas] = useState<AlertaCredito[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ alertas: AlertaCredito[] }>('/alertas', {
        params: { estado: estadoFiltro || undefined },
      });
      setAlertas(data.alertas);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [estadoFiltro]);

  const cambiarEstado = async (
    idAlerta: number,
    estado: 'REVISADA' | 'RESUELTA'
  ) => {
    await api.patch(`/alertas/${idAlerta}/estado`, { estado });
    await cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Alertas de Línea de Crédito
          </h2>
          <p className="text-sm text-slate-500">
            Monitoreo automático de cuentas que exceden o se aproximan a su
            límite de crédito.
          </p>
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVA">Activas</option>
          <option value="REVISADA">Revisadas</option>
          <option value="RESUELTA">Resueltas</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente / Cuenta</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Línea</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Excedido</th>
              <th className="px-4 py-3">Estado</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando alertas...
                </td>
              </tr>
            ) : alertas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No hay alertas registradas.
                </td>
              </tr>
            ) : (
              alertas.map((a) => (
                <tr key={a.id_alerta} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {formatDateTime(a.fecha_generacion)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {a.cliente_nombre}
                    </p>
                    <Link
                      to={`/cuentas/${a.id_cuenta}`}
                      className="text-xs font-mono text-indigo-600 hover:underline"
                    >
                      {a.numero_cuenta}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        a.tipo_alerta === 'EXCESO_LINEA'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {a.tipo_alerta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(a.linea_credito_momento, a.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(a.saldo_momento, a.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">
                    {formatMoney(a.monto_excedido, a.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        a.estado === 'ACTIVA'
                          ? 'bg-red-100 text-red-700'
                          : a.estado === 'REVISADA'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {a.estado}
                    </span>
                  </td>
                  {puedeEditar && (
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      {a.estado === 'ACTIVA' && (
                        <button
                          onClick={() => cambiarEstado(a.id_alerta, 'REVISADA')}
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded cursor-pointer"
                          title="Marcar como revisada"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {a.estado !== 'RESUELTA' && (
                        <button
                          onClick={() => cambiarEstado(a.id_alerta, 'RESUELTA')}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          title="Marcar como resuelta"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
