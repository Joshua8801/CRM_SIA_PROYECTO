import React, { useEffect, useState } from 'react';
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConciliacionCuenta, CuentaCorriente } from '../types';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';
import {
  validarImporteFrontend,
  validarPeriodoFrontend,
} from '../utils/validation';

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
  const [submitting, setSubmitting] = useState(false);

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

    const periodoCheck = validarPeriodoFrontend(fechaInicio, fechaFin);
    if (!periodoCheck.ok) {
      setPreview(null);
      setError(periodoCheck.error);
      return;
    }

    try {
      const { data } = await api.get<PreviewSistema>(
        '/conciliaciones/preview',
        {
          params: {
            id_cuenta: idCuenta,
            fecha_inicio: periodoCheck.fechaInicio,
            fecha_fin: periodoCheck.fechaFin,
          },
        }
      );
      setPreview(data);
    } catch (err: unknown) {
      setPreview(null);
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
      const iniCheck = validarImporteFrontend(next.saldo_inicial_manual, {
        campo: 'Saldo inicial',
        permitirNegativo: true,
      });
      const carCheck = validarImporteFrontend(next.total_cargos_manual, {
        campo: 'Total cargos',
        permitirCero: true,
      });
      const aboCheck = validarImporteFrontend(next.total_abonos_manual, {
        campo: 'Total abonos',
        permitirCero: true,
      });
      if (iniCheck.ok && carCheck.ok && aboCheck.ok) {
        const iniCents = toCents(iniCheck.valor);
        const carCents = toCents(carCheck.valor);
        const aboCents = toCents(aboCheck.valor);
        next.saldo_final_manual = fromCents(
          iniCents + carCents - aboCents
        ).toFixed(2);
      }
    }
    setManual(next);
  };

  const previewVigente =
    preview !== null &&
    String(preview.cuenta.id_cuenta) === idCuenta &&
    preview.periodo.fecha_inicio === fechaInicio &&
    preview.periodo.fecha_fin === fechaFin;

  const validacionManual = (() => {
    const ini = validarImporteFrontend(manual.saldo_inicial_manual, {
      campo: 'El saldo inicial manual',
      permitirNegativo: true,
    });
    const car = validarImporteFrontend(manual.total_cargos_manual, {
      campo: 'El total de cargos manual',
      permitirCero: true,
    });
    const abo = validarImporteFrontend(manual.total_abonos_manual, {
      campo: 'El total de abonos manual',
      permitirCero: true,
    });
    const fin = validarImporteFrontend(manual.saldo_final_manual, {
      campo: 'El saldo final manual',
      permitirNegativo: true,
    });
    return { ini, car, abo, fin };
  })();

  const todosManualesValidos =
    previewVigente &&
    validacionManual.ini.ok &&
    validacionManual.car.ok &&
    validacionManual.abo.ok &&
    validacionManual.fin.ok;

  const comparacionEnVivo = todosManualesValidos
    ? (() => {
        const iniVal = validacionManual.ini.ok ? validacionManual.ini.valor : 0;
        const carVal = validacionManual.car.ok ? validacionManual.car.valor : 0;
        const aboVal = validacionManual.abo.ok ? validacionManual.abo.valor : 0;
        const finVal = validacionManual.fin.ok ? validacionManual.fin.valor : 0;
        const items = [
          {
            campo: 'saldo_inicial',
            etiqueta: 'Saldo Inicial',
            sistema: fromCents(toCents(preview!.sistema.saldo_inicial_sistema)),
            manual: fromCents(toCents(iniVal)),
            difCents:
              toCents(preview!.sistema.saldo_inicial_sistema) -
              toCents(iniVal),
          },
          {
            campo: 'total_cargos',
            etiqueta: 'Total Cargos',
            sistema: fromCents(toCents(preview!.sistema.total_cargos_sistema)),
            manual: fromCents(toCents(carVal)),
            difCents:
              toCents(preview!.sistema.total_cargos_sistema) -
              toCents(carVal),
          },
          {
            campo: 'total_abonos',
            etiqueta: 'Total Abonos',
            sistema: fromCents(toCents(preview!.sistema.total_abonos_sistema)),
            manual: fromCents(toCents(aboVal)),
            difCents:
              toCents(preview!.sistema.total_abonos_sistema) -
              toCents(aboVal),
          },
          {
            campo: 'saldo_final',
            etiqueta: 'Saldo Final',
            sistema: fromCents(toCents(preview!.sistema.saldo_final_sistema)),
            manual: fromCents(toCents(finVal)),
            difCents:
              toCents(preview!.sistema.saldo_final_sistema) -
              toCents(finVal),
          },
        ].map((item) => ({
          ...item,
          diferencia: fromCents(item.difCents),
          discrepante: item.difCents !== 0,
        }));

        const discrepantes = items.filter((i) => i.discrepante);
        const formulaManualValida =
          toCents(finVal) ===
          toCents(iniVal) + toCents(carVal) - toCents(aboVal);

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
    if (submitting) return;
    setError('');
    setMensaje('');

    if (!previewVigente) {
      setError(
        'Debes calcular el período vigente antes de registrar la conciliación.'
      );
      return;
    }

    const periodoCheck = validarPeriodoFrontend(fechaInicio, fechaFin);
    if (!periodoCheck.ok) {
      setError(periodoCheck.error);
      return;
    }

    if (!validacionManual.ini.ok) {
      setError(validacionManual.ini.error);
      return;
    }
    if (!validacionManual.car.ok) {
      setError(validacionManual.car.error);
      return;
    }
    if (!validacionManual.abo.ok) {
      setError(validacionManual.abo.error);
      return;
    }
    if (!validacionManual.fin.ok) {
      setError(validacionManual.fin.error);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ conciliacion: ConciliacionCuenta }>(
        '/conciliaciones',
        {
          id_cuenta: Number(idCuenta),
          fecha_inicio: periodoCheck.fechaInicio,
          fecha_fin: periodoCheck.fechaFin,
          saldo_inicial_manual: validacionManual.ini.valor,
          total_cargos_manual: validacionManual.car.valor,
          total_abonos_manual: validacionManual.abo.valor,
          saldo_final_manual: validacionManual.fin.valor,
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-600" />
          Conciliación de estado de cuenta
        </h2>
        <p className="text-sm text-slate-500">
          Compara el saldo inicial, los cargos, los abonos y el saldo final del
          mismo período.
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
            onChange={(e) => {
              setIdCuenta(e.target.value);
              setPreview(null);
              setError('');
              setMensaje('');
            }}
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
            onChange={(e) => {
              setFechaInicio(e.target.value);
              setPreview(null);
              setError('');
              setMensaje('');
            }}
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
            onChange={(e) => {
              setFechaFin(e.target.value);
              setPreview(null);
              setError('');
              setMensaje('');
            }}
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
          noValidate
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
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                {submitting ? 'Registrando...' : 'Registrar Conciliación'}
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
