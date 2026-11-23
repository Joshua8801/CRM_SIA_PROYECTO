import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Wallet,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { formatDate, formatMoney } from '../utils/format';
import MonthlyMovementsChart, {
  SerieMonedaMensual,
} from '../components/MonthlyMovementsChart';

interface KpiMoneda {
  id_tipo_moneda: number;
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  cuentas_activas: number;
  cartera_por_cobrar: string;
  linea_credito_total: string;
  cuentas_excedidas: number;
}

interface DashboardData {
  kpis: {
    clientes_activos: number;
    cuentas_activas: number;
    alertas_activas: number;
    cuentas_excedidas: number;
  };
  kpisPorMoneda: KpiMoneda[];
  alertasRecientes: Array<{
    id_alerta: number;
    id_cuenta: number;
    tipo_alerta: string;
    monto_excedido: string;
    mensaje: string;
    cliente_nombre: string;
    numero_cuenta: string;
    moneda_simbolo: string;
  }>;
  proximosSeguimientos: Array<{
    id_interaccion: number;
    cliente_nombre: string;
    tipo_interaccion: string;
    asunto: string;
    fecha_proximo_seguimiento: string;
  }>;
  resumenSegmentos: Array<{
    segmento: string;
    id_tipo_moneda: number;
    moneda_codigo: string;
    moneda_simbolo: string;
    cantidad_clientes: number;
    saldo_total: string;
  }>;
  movimientosMensuales: SerieMonedaMensual[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monedaSel, setMonedaSel] = useState<number | null>(null);

  const cargarDashboard = () => {
    setLoading(true);
    setError('');
    api
      .get<DashboardData>('/dashboard')
      .then((res) => {
        setData(res.data);
        if (
          res.data.kpisPorMoneda?.length > 0 &&
          monedaSel === null
        ) {
          const pen =
            res.data.kpisPorMoneda.find((m) => m.moneda_codigo === 'PEN') ||
            res.data.kpisPorMoneda[0];
          setMonedaSel(pen.id_tipo_moneda);
        }
      })
      .catch(() => setError('No se pudo cargar el resumen del dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-500">Cargando resumen...</p>
        <MonthlyMovementsChart series={[]} loading={true} error="" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-red-600">{error}</p>
        <MonthlyMovementsChart
          series={[]}
          loading={false}
          error={error}
          onRetry={cargarDashboard}
        />
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;
  const kpiMonedaActual =
    data.kpisPorMoneda?.find((m) => m.id_tipo_moneda === monedaSel) ||
    data.kpisPorMoneda?.[0];
  const segmentosMoneda = data.resumenSegmentos.filter((s) =>
    kpiMonedaActual
      ? s.id_tipo_moneda === kpiMonedaActual.id_tipo_moneda
      : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Resumen Ejecutivo de Cartera
          </h2>
          <p className="text-sm text-slate-500">
            Estado en línea de clientes, cuentas corrientes y alertas de crédito.
          </p>
        </div>

        {data.kpisPorMoneda?.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Moneda:</span>
            <select
              aria-label="Moneda de resumen ejecutivo"
              value={kpiMonedaActual?.id_tipo_moneda ?? ''}
              onChange={(e) => setMonedaSel(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800"
            >
              {data.kpisPorMoneda.map((m) => (
                <option key={m.id_tipo_moneda} value={m.id_tipo_moneda}>
                  {m.moneda_codigo} ({m.moneda_simbolo})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>CLIENTES ACTIVOS</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {kpis.clientes_activos}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.cuentas_activas} cuentas corrientes activas
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>
              CARTERA POR COBRAR ({kpiMonedaActual?.moneda_codigo || 'PEN'})
            </span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatMoney(
              kpiMonedaActual?.cartera_por_cobrar || 0,
              kpiMonedaActual?.moneda_simbolo || 'S/'
            )}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Línea total:{' '}
            {formatMoney(
              kpiMonedaActual?.linea_credito_total || 0,
              kpiMonedaActual?.moneda_simbolo || 'S/'
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>ALERTAS ACTIVAS</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {kpis.alertas_activas}
          </p>
          <p className="text-xs text-red-600 font-medium mt-1">
            {kpis.cuentas_excedidas} cuentas exceden su línea
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>
              SEGMENTOS ({kpiMonedaActual?.moneda_codigo || 'PEN'})
            </span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="space-y-1 mt-1">
            {segmentosMoneda.map((s) => (
              <div
                key={`${s.segmento}-${s.moneda_codigo}`}
                className="flex justify-between text-xs text-slate-700"
              >
                <span>
                  {s.segmento} ({s.cantidad_clientes})
                </span>
                <span className="font-semibold">
                  {formatMoney(s.saldo_total, s.moneda_simbolo)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfica de barras agrupadas: Cargos y abonos mensuales */}
      <MonthlyMovementsChart
        series={data.movimientosMensuales || []}
        loading={loading}
        error={error}
        onRetry={cargarDashboard}
      />

      {/* Dos columnas: Alertas y Seguimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Alertas de Crédito Activas
            </h3>
            <Link
              to="/alertas"
              className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.alertasRecientes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay alertas activas en este momento.
            </p>
          ) : (
            <div className="space-y-3">
              {data.alertasRecientes.map((a) => (
                <div
                  key={a.id_alerta}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {a.cliente_nombre}
                    </p>
                    <p className="text-xs text-slate-600">{a.mensaje}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                      a.tipo_alerta === 'EXCESO_LINEA'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {a.tipo_alerta === 'EXCESO_LINEA'
                      ? 'Exceso'
                      : 'Próx. límite'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-600" />
              Próximos Seguimientos
            </h3>
            <Link
              to="/interacciones"
              className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
            >
              Ver historial <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.proximosSeguimientos.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay seguimientos programados.
            </p>
          ) : (
            <div className="space-y-3">
              {data.proximosSeguimientos.map((s) => (
                <div
                  key={s.id_interaccion}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.cliente_nombre}
                    </p>
                    <p className="text-xs text-slate-600">
                      {s.tipo_interaccion}: {s.asunto}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                    {formatDate(s.fecha_proximo_seguimiento)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
