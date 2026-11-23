import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { CuentaCorriente } from '../types';
import { formatMoney } from '../utils/format';

export default function CuentasPage() {
  const [params] = useSearchParams();
  const esReporte = params.get('vista') === 'estado';
  const vista = esReporte ? 'estado' : 'movimientos';
  const [cuentas, setCuentas] = useState<CuentaCorriente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [soloExcedidas, setSoloExcedidas] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ cuentas: CuentaCorriente[] }>(
        '/cuentas',
        {
          params: {
            search: search || undefined,
            solo_excedidas: soloExcedidas ? 'true' : undefined,
          },
        }
      );
      setCuentas(data.cuentas);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [soloExcedidas]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {esReporte ? 'Estado de cuenta' : 'Registro de movimientos'}
        </h2>
        <p className="text-sm text-slate-500">
          {esReporte
            ? 'Selecciona una cuenta para consultar e imprimir su estado por período.'
            : 'Selecciona una cuenta para registrar cargos o abonos.'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargar()}
            placeholder="Buscar por N° cuenta, cliente o documento..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={soloExcedidas}
            onChange={(e) => setSoloExcedidas(e.target.checked)}
            className="rounded border-slate-300"
          />
          Solo con línea excedida
        </label>
        <button
          onClick={cargar}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm rounded-lg cursor-pointer"
        >
          Buscar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">N° Cuenta</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3 text-right">Línea Crédito</th>
              <th className="px-4 py-3 text-right">Saldo Actual</th>
              <th className="px-4 py-3 text-right">Disponible</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando cuentas...
                </td>
              </tr>
            ) : cuentas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No se encontraron cuentas corrientes.
                </td>
              </tr>
            ) : (
              cuentas.map((cc) => (
                <tr key={cc.id_cuenta} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">
                    {cc.numero_cuenta}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {cc.cliente_nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {cc.tipo_documento_codigo}: {cc.numero_documento}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {cc.segmento_nombre}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(cc.linea_credito, cc.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        cc.excede_linea ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {cc.excede_linea && <AlertTriangle className="w-3.5 h-3.5" />}
                      {formatMoney(cc.saldo_actual, cc.moneda_simbolo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        Number(cc.credito_disponible) < 0
                          ? 'text-red-600 font-medium'
                          : 'text-emerald-700 font-medium'
                      }
                    >
                      {formatMoney(cc.credito_disponible, cc.moneda_simbolo)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        cc.estado === 'ACTIVA'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cc.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/cuentas/${cc.id_cuenta}?vista=${vista}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {esReporte ? 'Ver estado de cuenta' : 'Ver movimientos'}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
