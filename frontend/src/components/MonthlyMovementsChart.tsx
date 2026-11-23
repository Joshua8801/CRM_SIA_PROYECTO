import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { formatMoney } from '../utils/format';

export interface SerieMonedaMensual {
  id_tipo_moneda: number;
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  meses: Array<{
    periodo: string; // YYYY-MM
    cargos: number;
    abonos: number;
  }>;
}

interface MonthlyMovementsChartProps {
  series: SerieMonedaMensual[];
  loading: boolean;
  error: string;
  onRetry?: () => void;
}

const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function formatPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const idx = Number(mes) - 1;
  if (idx < 0 || idx > 11 || !anio) return periodo;
  return `${MESES_CORTOS[idx]} ${anio.slice(2)}`;
}

export default function MonthlyMovementsChart({
  series,
  loading,
  error,
  onRetry,
}: MonthlyMovementsChartProps) {
  const [selectedMonedaId, setSelectedMonedaId] = useState<number | null>(null);
  const [activo, setActivo] = useState<{
    periodo: string;
    tipo: 'Cargos' | 'Abonos';
    monto: number;
    xPct: number;
  } | null>(null);

  useEffect(() => {
    if (series.length === 0) return;
    if (
      selectedMonedaId !== null &&
      series.some((s) => s.id_tipo_moneda === selectedMonedaId)
    ) {
      return;
    }
    const conDatos = series.find((s) =>
      s.meses.some((m) => m.cargos > 0 || m.abonos > 0)
    );
    setSelectedMonedaId((conDatos || series[0]).id_tipo_moneda);
  }, [series, selectedMonedaId]);

  const serieActual =
    series.find((s) => s.id_tipo_moneda === selectedMonedaId) || series[0];

  const tieneDatos =
    !!serieActual &&
    serieActual.meses.some((m) => m.cargos > 0 || m.abonos > 0);

  const maxValor = serieActual
    ? Math.max(
        1,
        ...serieActual.meses.flatMap((m) => [m.cargos, m.abonos])
      )
    : 1;

  // Escala superior redondeada para líneas guía limpias
  const stepBase = Math.pow(10, Math.floor(Math.log10(maxValor)));
  const maxEscala = Math.ceil(maxValor / stepBase) * stepBase;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxEscala * f);

  return (
    <section
      aria-label="Cargos y abonos mensuales"
      className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#1e3a8a]" />
            Cargos y abonos mensuales
          </h3>
          <p className="text-xs text-slate-500">
            Últimos 6 meses (movimientos confirmados, sin promesas de pago).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: '#1e3a8a' }}
              />
              Cargos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: '#0d9488' }}
              />
              Abonos
            </span>
          </div>

          {/* Selector de moneda cuando hay varias */}
          {series.length > 1 && (
            <select
              aria-label="Moneda de la gráfica"
              value={selectedMonedaId ?? ''}
              onChange={(e) => {
                setSelectedMonedaId(Number(e.target.value));
                setActivo(null);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium"
            >
              {series.map((s) => (
                <option key={s.id_tipo_moneda} value={s.id_tipo_moneda}>
                  {s.moneda_codigo} ({s.moneda_simbolo})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Estados: carga / error / sin datos / gráfica */}
      {loading ? (
        <div className="h-56 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
          Cargando gráfica de movimientos mensuales...
        </div>
      ) : error ? (
        <div className="h-56 flex flex-col items-center justify-center gap-2 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700 p-4 text-center">
          <p>{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          )}
        </div>
      ) : !serieActual || !tieneDatos ? (
        <div className="h-56 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 text-center p-4">
          No hay cargos ni abonos registrados en los últimos 6 meses
          {serieActual ? ` para ${serieActual.moneda_codigo}` : ''}.
        </div>
      ) : (
        <div className="relative overflow-x-auto pb-1">
          {/* Tooltip accesible por cursor o teclado */}
          {activo && (
            <div
              role="status"
              style={{
                left: `${Math.min(82, Math.max(18, activo.xPct))}%`,
              }}
              className="absolute top-1 -translate-x-1/2 z-10 pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-md whitespace-nowrap"
            >
              <span className="font-semibold">
                {formatPeriodo(activo.periodo)}
              </span>{' '}
              · {activo.tipo}:{' '}
              <span className="font-bold">
                {formatMoney(activo.monto, serieActual.moneda_simbolo)}
              </span>
            </div>
          )}

          <div className="min-w-[460px]">
            <svg
              viewBox="0 0 640 230"
              className="w-full h-56 select-none overflow-visible"
              role="img"
              aria-label={`Gráfica de barras agrupadas de cargos y abonos mensuales en ${serieActual.moneda_codigo}`}
            >
              {/* Líneas guía horizontales y etiquetas eje Y */}
              {ticks.map((val, idx) => {
                const y = 185 - (idx / (ticks.length - 1)) * 150;
                return (
                  <g key={idx}>
                    <line
                      x1="68"
                      y1={y}
                      x2="620"
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={idx === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="60"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[10px]"
                    >
                      {serieActual.moneda_simbolo}{' '}
                      {val.toLocaleString('es-PE', {
                        maximumFractionDigits: 0,
                      })}
                    </text>
                  </g>
                );
              })}

              {/* Grupos por mes */}
              {serieActual.meses.map((m, i) => {
                const groupWidth = (620 - 80) / serieActual.meses.length;
                const centerX = 80 + i * groupWidth + groupWidth / 2;
                const barWidth = 22;
                const gap = 6;

                const hCargos =
                  m.cargos > 0 ? Math.max(3, (m.cargos / maxEscala) * 150) : 0;
                const hAbonos =
                  m.abonos > 0 ? Math.max(3, (m.abonos / maxEscala) * 150) : 0;

                const xCargos = centerX - barWidth - gap / 2;
                const yCargos = 185 - hCargos;
                const xAbonos = centerX + gap / 2;
                const yAbonos = 185 - hAbonos;

                const xPct = (centerX / 640) * 100;

                return (
                  <g key={m.periodo}>
                    {/* Barra Cargos (azul marino) */}
                    <rect
                      x={xCargos}
                      y={hCargos > 0 ? yCargos : 183}
                      width={barWidth}
                      height={hCargos > 0 ? hCargos : 2}
                      rx="3"
                      fill="#1e3a8a"
                      tabIndex={0}
                      aria-label={`${formatPeriodo(m.periodo)} Cargos: ${formatMoney(m.cargos, serieActual.moneda_simbolo)}`}
                      className="cursor-pointer transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onMouseEnter={() =>
                        setActivo({
                          periodo: m.periodo,
                          tipo: 'Cargos',
                          monto: m.cargos,
                          xPct,
                        })
                      }
                      onMouseLeave={() => setActivo(null)}
                      onFocus={() =>
                        setActivo({
                          periodo: m.periodo,
                          tipo: 'Cargos',
                          monto: m.cargos,
                          xPct,
                        })
                      }
                      onBlur={() => setActivo(null)}
                    />

                    {/* Barra Abonos (verde teal) */}
                    <rect
                      x={xAbonos}
                      y={hAbonos > 0 ? yAbonos : 183}
                      width={barWidth}
                      height={hAbonos > 0 ? hAbonos : 2}
                      rx="3"
                      fill="#0d9488"
                      tabIndex={0}
                      aria-label={`${formatPeriodo(m.periodo)} Abonos: ${formatMoney(m.abonos, serieActual.moneda_simbolo)}`}
                      className="cursor-pointer transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onMouseEnter={() =>
                        setActivo({
                          periodo: m.periodo,
                          tipo: 'Abonos',
                          monto: m.abonos,
                          xPct,
                        })
                      }
                      onMouseLeave={() => setActivo(null)}
                      onFocus={() =>
                        setActivo({
                          periodo: m.periodo,
                          tipo: 'Abonos',
                          monto: m.abonos,
                          xPct,
                        })
                      }
                      onBlur={() => setActivo(null)}
                    />

                    {/* Etiqueta Mes */}
                    <text
                      x={centerX}
                      y="206"
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium"
                    >
                      {formatPeriodo(m.periodo)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
