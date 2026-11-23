import React, { useEffect, useState } from 'react';
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConciliacionCuenta, CuentaCorriente } from '../types';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';

interface PreviewSistema {
  cuenta: CuentaCorriente;
  periodo: { fecha_inicio: string; fecha_fin: string };
  sistema: {
    saldo_inicial_sistema: number;
    total_cargos_sistema: number;
    total_abonos_sistema: number;
    saldo_final_sistema: number;
    cantidad_movimientos: number;
  };
}

function toCents(val: string | number): number {
  return Math.round(Number(val) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export default function ConciliacionPage() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaCorriente[]>([]);
  const [historial, setHistorial] = useState<ConciliacionCuenta[]>([]);
  const [idCuenta, setIdCuenta] = useState('');

  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(primerDia);
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().slice(0, 10));

  const [preview, setPreview] = useState<PreviewSistema | null>(null);
  const [manual, setManual] = useState({
    saldo_inicial_manual: '',
    total_cargos_manual: '',
    total_abonos_manual: '',
    saldo_final_manual: '',
    observaciones: '',
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargarInicial = async () => {
    const [cuentasRes, histRes] = await Promise.all([
      api.get<{ cuentas: CuentaCorriente[] }>('/cuentas'),
      api.get<{ conciliaciones: ConciliacionCuenta[] }>('/conciliaciones'),
    ]);
    setCuentas(cuentasRes.data.cuentas);
    setHistorial(histRes.data.conciliaciones);
    if (cuentasRes.data.cuentas.length > 0 && !idCuenta) {
      setIdCuenta(String(cuentasRes.data.cuentas[0].id_cuenta));
    }
  };

  useEffect(() => {
    cargarInicial();
  }, []);

  const consultarSistema = async () => {
    setError('');
    setMensaje('');
    if (!idCuenta) return;
    try {
      const { data } = await api.get<PreviewSistema>(
        '/conciliaciones/preview',
        {
          params: {
            id_cuenta: idCuenta,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
          },
        }
      );
      setPreview(data);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al calcular datos del sistema.'
      );
    }
  };

  const actualizarCampoManual = (campo: string, valor: string) => {
    const next = { ...manual, [campo]: valor };
    if (
      campo === 'saldo_inicial_manual' ||
      campo === 'total_cargos_manual' ||
      campo === 'total_abonos_manual'
    ) {
      const iniCents = toCents(next.saldo_inicial_manual || 0);
      const carCents = toCents(next.total_cargos_manual || 0);
      const aboCents = toCents(next.total_abonos_manual || 0);
      next.saldo_final_manual = fromCents(
        iniCents + carCents - aboCents
      ).toFixed(2);
    }
    setManual(next);
  };

  const todosManualesCompletos =
    preview !== null &&
    manual.saldo_inicial_manual !== '' &&
    manual.total_cargos_manual !== '' &&
    manual.total_abonos_manual !== '' &&
    manual.saldo_final_manual !== '';

  const comparacionEnVivo = todosManualesCompletos
    ? (() => {
        const items = [
          {
            campo: 'saldo_inicial',
            etiqueta: 'Saldo Inicial',
            sistema: fromCents(toCents(preview.sistema.saldo_inicial_sistema)),
            manual: fromCents(toCents(manual.saldo_inicial_manual)),
            difCents:
              toCents(preview.sistema.saldo_inicial_sistema) -
              toCents(manual.saldo_inicial_manual),
          },
          {
            campo: 'total_cargos',
            etiqueta: 'Total Cargos',
            sistema: fromCents(toCents(preview.sistema.total_cargos_sistema)),
            manual: fromCents(toCents(manual.total_cargos_manual)),
            difCents:
              toCents(preview.sistema.total_cargos_sistema) -
              toCents(manual.total_cargos_manual),
          },
          {
            campo: 'total_abonos',
            etiqueta: 'Total Abonos',
            sistema: fromCents(toCents(preview.sistema.total_abonos_sistema)),
            manual: fromCents(toCents(manual.total_abonos_manual)),
            difCents:
              toCents(preview.sistema.total_abonos_sistema) -
              toCents(manual.total_abonos_manual),
          },
          {
            campo: 'saldo_final',
            etiqueta: 'Saldo Final',
            sistema: fromCents(toCents(preview.sistema.saldo_final_sistema)),
            manual: fromCents(toCents(manual.saldo_final_manual)),
            difCents:
              toCents(preview.sistema.saldo_final_sistema) -
              toCents(manual.saldo_final_manual),
          },
        ].map((item) => ({
          ...item,
          diferencia: fromCents(item.difCents),
          discrepante: item.difCents !== 0,
        }));

        const discrepantes = items.filter((i) => i.discrepante);
        const formulaManualValida =
          toCents(manual.saldo_final_manual) ===
          toCents(manual.saldo_inicial_manual) +
            toCents(manual.total_cargos_manual) -
            toCents(manual.total_abonos_manual);

        return {
          items,
          discrepantes,
          conciliado: discrepantes.length === 0,
          formulaManualValida,
        };
      })()
    : null;

  const handleGuardarConciliacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const { data } = await api.post<{ conciliacion: ConciliacionCuenta }>(
        '/conciliaciones',
        {
          id_cuenta: Number(idCuenta),
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          saldo_inicial_manual: Number(manual.saldo_inicial_manual),
          total_cargos_manual: Number(manual.total_cargos_manual),
          total_abonos_manual: Number(manual.total_abonos_manual),
          saldo_final_manual: Number(manual.saldo_final_manual),
          observaciones: manual.observaciones || null,
        }
      );

      const saved = data.conciliacion;
      if (saved.estado === 'CONCILIADO') {
        setMensaje(
          'Conciliación registrada como CONCILIADO: los cuatro importes coinciden exactamente.'
        );
      } else {
        const detalleDiscrepancias = (saved.partidas_discrepantes || [])
          .map((p) => p.etiqueta)
          .join(', ');
        setMensaje(
          `Conciliación registrada como CON_DIFERENCIA${
            detalleDiscrepancias
              ? ` (partidas discrepantes: ${detalleDiscrepancias})`
              : ''
          }.`
        );
      }

      await cargarInicial();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al registrar conciliación.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-600" />
          Conciliación de Estado de Cuenta
        </h2>
        <p className="text-sm text-slate-500">
          Producto diferenciador: compara el cálculo automático del sistema
          frente al cálculo manual del mismo período en sus cuatro importes.
        </p>
      </div>

      {/* Selector de cuenta y período */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Cuenta Corriente
          </label>
          <select
            value={idCuenta}
            onChange={(e) => setIdCuenta(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {cuentas.map((cc) => (
              <option key={cc.id_cuenta} value={cc.id_cuenta}>
                {cc.numero_cuenta} — {cc.cliente_nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Fecha Inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Fecha Fin
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={consultarSistema}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
        >
          Calcular Período
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
          {mensaje}
        </div>
      )}

      {/* Comparador lado a lado */}
      {preview && (
        <form
          onSubmit={handleGuardarConciliacion}
          className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna Sistema */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-semibold text-slate-900">
                1. Cálculo del Sistema ({preview.sistema.cantidad_movimientos}{' '}
                movs.)
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo Inicial:</span>
                  <span className="font-semibold">
                    {formatMoney(
                      preview.sistema.saldo_inicial_sistema,
                      preview.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">(+) Total Cargos:</span>
                  <span className="font-semibold text-rose-700">
                    {formatMoney(
                      preview.sistema.total_cargos_sistema,
                      preview.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">(-) Total Abonos:</span>
                  <span className="font-semibold text-emerald-700">
                    {formatMoney(
                      preview.sistema.total_abonos_sistema,
                      preview.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-300 text-base">
                  <span className="font-bold text-slate-900">Saldo Final:</span>
                  <span className="font-bold text-indigo-700">
                    {formatMoney(
                      preview.sistema.saldo_final_sistema,
                      preview.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Columna Manual */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <h3 className="font-semibold text-slate-900">
                2. Cálculo Manual del Período
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Saldo Inicial Manual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manual.saldo_inicial_manual}
                    onChange={(e) =>
                      actualizarCampoManual(
                        'saldo_inicial_manual',
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Total Cargos Manual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={manual.total_cargos_manual}
                    onChange={(e) =>
                      actualizarCampoManual(
                        'total_cargos_manual',
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Total Abonos Manual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={manual.total_abonos_manual}
                    onChange={(e) =>
                      actualizarCampoManual(
                        'total_abonos_manual',
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Saldo Final Manual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manual.saldo_final_manual}
                    onChange={(e) =>
                      actualizarCampoManual('saldo_final_manual', e.target.value)
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resultado en vivo y desglose de los 4 importes */}
          {comparacionEnVivo && (
            <div className="space-y-3">
              <div
                className={`p-4 rounded-lg border flex flex-col gap-1 ${
                  !comparacionEnVivo.formulaManualValida
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : comparacionEnVivo.conciliado
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {!comparacionEnVivo.formulaManualValida ? (
                    <>
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>
                        Inconsistencia en cálculo manual: Saldo final manual debe
                        ser igual a Saldo inicial + Cargos - Abonos.
                      </span>
                    </>
                  ) : comparacionEnVivo.conciliado ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>
                        CONCILIADO: Los cuatro importes (saldo inicial, cargos,
                        abonos y saldo final) coinciden exactamente.
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>
                        CON_DIFERENCIA: Existen discrepancias en{' '}
                        {comparacionEnVivo.discrepantes
                          .map((d) => d.etiqueta)
                          .join(', ')}
                        .
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Desglose por cada importe */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Importe</th>
                      <th className="px-3 py-2 text-right">Sistema</th>
                      <th className="px-3 py-2 text-right">Manual</th>
                      <th className="px-3 py-2 text-right">
                        Diferencia (Sis - Man)
                      </th>
                      <th className="px-3 py-2 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparacionEnVivo.items.map((item) => (
                      <tr
                        key={item.campo}
                        className={item.discrepante ? 'bg-amber-50/60' : ''}
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {item.etiqueta}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(
                            item.sistema,
                            preview.cuenta.moneda_simbolo
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(
                            item.manual,
                            preview.cuenta.moneda_simbolo
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            item.discrepante
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {formatMoney(
                            item.diferencia,
                            preview.cuenta.moneda_simbolo
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${
                              item.discrepante
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {item.discrepante ? 'Discrepante' : 'Coincide'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Observaciones de la conciliación
            </label>
            <textarea
              rows={2}
              value={manual.observaciones}
              onChange={(e) =>
                setManual({ ...manual, observaciones: e.target.value })
              }
              placeholder="Ej. Diferencia por nota de crédito pendiente de registro..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {puedeEditar && (
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                Registrar Conciliación
              </button>
            </div>
          )}
        </form>
      )}

      {/* Historial de conciliaciones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">
            Historial de Conciliaciones Registradas
          </h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cuenta / Cliente</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3 text-right">Saldo Sistema</th>
              <th className="px-4 py-3 text-right">Saldo Manual</th>
              <th className="px-4 py-3 text-right">Dif. Saldo Final</th>
              <th className="px-4 py-3">Diferencias por Partida</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historial.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No hay conciliaciones registradas aún.
                </td>
              </tr>
            ) : (
              historial.map((h) => (
                <tr key={h.id_conciliacion} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatDateTime(h.fecha_conciliacion)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {h.cliente_nombre}
                    </p>
                    <p className="text-xs font-mono text-slate-500">
                      {h.numero_cuenta}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatDate(h.fecha_inicio)} - {formatDate(h.fecha_fin)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(h.saldo_final_sistema, h.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(h.saldo_final_manual, h.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(h.diferencia_saldo, h.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!h.partidas_discrepantes ||
                    h.partidas_discrepantes.length === 0 ? (
                      <span className="text-emerald-700">Sin diferencias</span>
                    ) : (
                      <div className="space-y-0.5">
                        {h.partidas_discrepantes.map((p) => (
                          <div key={p.campo} className="text-amber-800">
                            <span className="font-medium">{p.etiqueta}:</span>{' '}
                            {formatMoney(p.diferencia, h.moneda_simbolo)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        h.estado === 'CONCILIADO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {h.estado}
                    </span>
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
