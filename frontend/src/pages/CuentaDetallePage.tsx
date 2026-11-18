import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Printer,
  Ban,
  AlertTriangle,
  FileText,
  List,
  Link2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CuentaCorriente, MovimientoCuenta } from '../types';
import { formatDate, formatMoney } from '../utils/format';

interface EstadoCuentaResp {
  cuenta: CuentaCorriente & {
    direccion?: string;
    email?: string;
    telefono?: string;
    moneda_nombre?: string;
  };
  periodo: { fecha_inicio: string; fecha_fin: string };
  resumen: {
    saldo_inicial: number;
    total_cargos: number;
    total_abonos: number;
    saldo_final: number;
  };
  movimientos: Array<
    MovimientoCuenta & {
      cargo: number;
      abono: number;
      saldo_acumulado: number;
    }
  >;
}

export default function CuentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { catalogos, usuario } = useAuth();
  const [tab, setTab] = useState<'movimientos' | 'estado'>('movimientos');
  const [cuenta, setCuenta] = useState<CuentaCorriente | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [aplicarModalOpen, setAplicarModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [aplicarError, setAplicarError] = useState('');

  // Estado de cuenta por período
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(primerDia);
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().slice(0, 10));
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaResp | null>(
    null
  );

  // Nuevo movimiento
  const [movForm, setMovForm] = useState({
    id_tipo_movimiento: '',
    numero_documento_ref: '',
    fecha_movimiento: hoy.toISOString().slice(0, 10),
    fecha_vencimiento: '',
    monto: '',
    glosa: '',
    id_cargo_a_aplicar: '',
  });

  // Aplicar pago existente
  const [aplicarForm, setAplicarForm] = useState({
    id_movimiento_abono: '',
    id_movimiento_cargo: '',
    monto_aplicado: '',
  });

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargarCuenta = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        cuenta: CuentaCorriente;
        movimientos: MovimientoCuenta[];
      }>(`/cuentas/${id}`);
      setCuenta(data.cuenta);
      setMovimientos(data.movimientos);
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadoCuenta = async () => {
    const { data } = await api.get<EstadoCuentaResp>(
      `/cuentas/${id}/estado-cuenta`,
      { params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin } }
    );
    setEstadoCuenta(data);
  };

  useEffect(() => {
    cargarCuenta();
  }, [id]);

  useEffect(() => {
    if (tab === 'estado') {
      cargarEstadoCuenta();
    }
  }, [tab, id]);

  const cargosPendientes = movimientos.filter(
    (m) =>
      m.naturaleza === 'C' &&
      Number(m.saldo_pendiente) > 0 &&
      m.estado_codigo !== 'ANULADO'
  );

  const abonosDisponibles = movimientos.filter(
    (m) =>
      m.naturaleza === 'A' &&
      Number(m.saldo_pendiente) > 0 &&
      m.estado_codigo !== 'ANULADO'
  );

  const abrirNuevoMovimiento = () => {
    const primerTipo = catalogos?.tiposMovimiento[0];
    setMovForm({
      id_tipo_movimiento: primerTipo
        ? String(primerTipo.id_tipo_movimiento)
        : '',
      numero_documento_ref: '',
      fecha_movimiento: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: '',
      monto: '',
      glosa: '',
      id_cargo_a_aplicar: '',
    });
    setError('');
    setModalOpen(true);
  };

  const abrirAplicarPago = () => {
    const primerAbono = abonosDisponibles[0];
    const primerCargo = cargosPendientes[0];
    const sugerido =
      primerAbono && primerCargo
        ? Math.min(
            Number(primerAbono.saldo_pendiente),
            Number(primerCargo.saldo_pendiente)
          ).toFixed(2)
        : '';
    setAplicarForm({
      id_movimiento_abono: primerAbono ? String(primerAbono.id_movimiento) : '',
      id_movimiento_cargo: primerCargo ? String(primerCargo.id_movimiento) : '',
      monto_aplicado: sugerido,
    });
    setAplicarError('');
    setAplicarModalOpen(true);
  };

  const tipoSeleccionado = catalogos?.tiposMovimiento.find(
    (t) => String(t.id_tipo_movimiento) === movForm.id_tipo_movimiento
  );

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/movimientos', {
        id_cuenta: Number(id),
        id_tipo_movimiento: Number(movForm.id_tipo_movimiento),
        numero_documento_ref: movForm.numero_documento_ref || null,
        fecha_movimiento: movForm.fecha_movimiento,
        fecha_vencimiento: movForm.fecha_vencimiento || null,
        monto: Number(movForm.monto),
        glosa: movForm.glosa,
        id_cargo_a_aplicar: movForm.id_cargo_a_aplicar
          ? Number(movForm.id_cargo_a_aplicar)
          : null,
      });
      setModalOpen(false);
      await cargarCuenta();
      if (tab === 'estado') await cargarEstadoCuenta();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al registrar movimiento.'
      );
    }
  };

  const handleAplicarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setAplicarError('');
    try {
      await api.post('/movimientos/aplicar-pago', {
        id_movimiento_abono: Number(aplicarForm.id_movimiento_abono),
        id_movimiento_cargo: Number(aplicarForm.id_movimiento_cargo),
        monto_aplicado: Number(aplicarForm.monto_aplicado),
      });
      setAplicarModalOpen(false);
      await cargarCuenta();
    } catch (err: unknown) {
      setAplicarError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al aplicar el pago.'
      );
    }
  };

  const handleAnular = async (idMov: number) => {
    if (!window.confirm('¿Desea anular este movimiento?')) return;
    try {
      await api.post(`/movimientos/${idMov}/anular`);
      await cargarCuenta();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'No se pudo anular el movimiento.'
      );
    }
  };

  if (loading || !cuenta) {
    return <p className="text-sm text-slate-500">Cargando cuenta corriente...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/cuentas"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {cuenta.cliente_nombre}
            </h2>
            <p className="text-xs text-slate-500">
              Cuenta {cuenta.numero_cuenta} · {cuenta.tipo_documento_codigo}:{' '}
              {cuenta.numero_documento} · Segmento {cuenta.segmento_nombre}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {puedeEditar &&
            abonosDisponibles.length > 0 &&
            cargosPendientes.length > 0 && (
              <button
                onClick={abrirAplicarPago}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                Aplicar Pago
              </button>
            )}
          {puedeEditar && (
            <button
              onClick={abrirNuevoMovimiento}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Cargo / Abono
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de saldo calculado en línea */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">LÍNEA DE CRÉDITO</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatMoney(cuenta.linea_credito, cuenta.moneda_simbolo)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">
            SALDO CALCULADO EN LÍNEA
          </p>
          <p
            className={`text-xl font-bold mt-1 flex items-center gap-1.5 ${
              cuenta.excede_linea ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {cuenta.excede_linea && <AlertTriangle className="w-5 h-5" />}
            {formatMoney(cuenta.saldo_actual, cuenta.moneda_simbolo)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">
            CRÉDITO DISPONIBLE
          </p>
          <p
            className={`text-xl font-bold mt-1 ${
              Number(cuenta.credito_disponible) < 0
                ? 'text-red-600'
                : 'text-emerald-700'
            }`}
          >
            {formatMoney(cuenta.credito_disponible, cuenta.moneda_simbolo)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('movimientos')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer ${
            tab === 'movimientos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <List className="w-4 h-4" />
          Movimientos en Línea
        </button>
        <button
          onClick={() => setTab('estado')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer ${
            tab === 'estado'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Estado de Cuenta Imprimible
        </button>
      </div>

      {/* Tab 1: Movimientos */}
      {tab === 'movimientos' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Doc. Ref</th>
                <th className="px-4 py-3">Glosa</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
                <th className="px-4 py-3 text-right">Saldo Acum.</th>
                <th className="px-4 py-3">Estado</th>
                {puedeEditar && <th className="px-4 py-3 text-right">Anular</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.map((m) => (
                <tr
                  key={m.id_movimiento}
                  className={
                    m.estado_codigo === 'ANULADO'
                      ? 'bg-slate-50 text-slate-400 line-through'
                      : 'hover:bg-slate-50'
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(m.fecha_movimiento)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.naturaleza === 'C'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {m.tipo_nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {m.numero_documento_ref || '—'}
                  </td>
                  <td className="px-4 py-3">{m.glosa}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      m.naturaleza === 'C'
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {m.naturaleza === 'C' ? '+' : '-'}
                    {formatMoney(m.monto, cuenta.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatMoney(m.saldo_pendiente, cuenta.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatMoney(
                      m.saldo_calculado ?? 0,
                      cuenta.moneda_simbolo
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    {m.estado_codigo}
                  </td>
                  {puedeEditar && (
                    <td className="px-4 py-3 text-right">
                      {m.estado_codigo !== 'ANULADO' && (
                        <button
                          onClick={() => handleAnular(m.id_movimiento)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Anular movimiento"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Estado de Cuenta Imprimible */}
      {tab === 'estado' && (
        <div className="space-y-4">
          <div className="no-print bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
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
              onClick={cargarEstadoCuenta}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm rounded-lg cursor-pointer"
            >
              Generar Estado
            </button>
            <button
              onClick={() => window.print()}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Estado de Cuenta
            </button>
          </div>

          {estadoCuenta && (
            <div className="print-container bg-white rounded-xl border border-slate-200 p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ESTADO DE CUENTA CORRIENTE
                  </h3>
                  <p className="text-sm text-slate-700 font-medium mt-1">
                    {estadoCuenta.cuenta.cliente_nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    {estadoCuenta.cuenta.tipo_documento_codigo}:{' '}
                    {estadoCuenta.cuenta.numero_documento} · Cuenta:{' '}
                    {estadoCuenta.cuenta.numero_cuenta}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>
                    <span className="font-semibold">Período:</span>{' '}
                    {formatDate(estadoCuenta.periodo.fecha_inicio)} al{' '}
                    {formatDate(estadoCuenta.periodo.fecha_fin)}
                  </p>
                  <p>
                    <span className="font-semibold">Moneda:</span>{' '}
                    {estadoCuenta.cuenta.moneda_codigo}
                  </p>
                  <p>
                    <span className="font-semibold">Línea de Crédito:</span>{' '}
                    {formatMoney(
                      estadoCuenta.cuenta.linea_credito,
                      estadoCuenta.cuenta.moneda_simbolo
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">
                    Saldo Inicial
                  </span>
                  <span className="font-bold">
                    {formatMoney(
                      estadoCuenta.resumen.saldo_inicial,
                      estadoCuenta.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    (+) Total Cargos
                  </span>
                  <span className="font-bold text-rose-700">
                    {formatMoney(
                      estadoCuenta.resumen.total_cargos,
                      estadoCuenta.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    (-) Total Abonos
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatMoney(
                      estadoCuenta.resumen.total_abonos,
                      estadoCuenta.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    Saldo Final Período
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatMoney(
                      estadoCuenta.resumen.saldo_final,
                      estadoCuenta.cuenta.moneda_simbolo
                    )}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Concepto / Glosa</th>
                    <th className="px-3 py-2 text-right">Cargo</th>
                    <th className="px-3 py-2 text-right">Abono</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estadoCuenta.movimientos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        Sin movimientos en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    estadoCuenta.movimientos.map((m) => (
                      <tr key={m.id_movimiento}>
                        <td className="px-3 py-2">
                          {formatDate(m.fecha_movimiento)}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {m.numero_documento_ref || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{m.tipo_nombre}</span> —{' '}
                          {m.glosa}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m.cargo > 0
                            ? formatMoney(
                                m.cargo,
                                estadoCuenta.cuenta.moneda_simbolo
                              )
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m.abono > 0
                            ? formatMoney(
                                m.abono,
                                estadoCuenta.cuenta.moneda_simbolo
                              )
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatMoney(
                            m.saldo_acumulado,
                            estadoCuenta.cuenta.moneda_simbolo
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Registrar Cargo o Abono
            </h3>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleRegistrarMovimiento} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Movimiento
                </label>
                <select
                  value={movForm.id_tipo_movimiento}
                  onChange={(e) =>
                    setMovForm({
                      ...movForm,
                      id_tipo_movimiento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {catalogos?.tiposMovimiento.map((t) => (
                    <option
                      key={t.id_tipo_movimiento}
                      value={t.id_tipo_movimiento}
                    >
                      [{t.naturaleza === 'C' ? 'CARGO' : 'ABONO'}] {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto ({cuenta.moneda_simbolo})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={movForm.monto}
                    onChange={(e) =>
                      setMovForm({ ...movForm, monto: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    N° Doc. Referencia
                  </label>
                  <input
                    type="text"
                    value={movForm.numero_documento_ref}
                    onChange={(e) =>
                      setMovForm({
                        ...movForm,
                        numero_documento_ref: e.target.value,
                      })
                    }
                    placeholder="F001-000123 / OP-44"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha Movimiento
                  </label>
                  <input
                    type="date"
                    required
                    value={movForm.fecha_movimiento}
                    onChange={(e) =>
                      setMovForm({
                        ...movForm,
                        fecha_movimiento: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                {tipoSeleccionado?.requiere_vencimiento && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Fecha Vencimiento
                    </label>
                    <input
                      type="date"
                      value={movForm.fecha_vencimiento}
                      onChange={(e) =>
                        setMovForm({
                          ...movForm,
                          fecha_vencimiento: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>

              {tipoSeleccionado?.naturaleza === 'A' &&
                cargosPendientes.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Aplicar a Cargo Pendiente (opcional)
                    </label>
                    <select
                      value={movForm.id_cargo_a_aplicar}
                      onChange={(e) =>
                        setMovForm({
                          ...movForm,
                          id_cargo_a_aplicar: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">-- Sin aplicación directa --</option>
                      {cargosPendientes.map((c) => (
                        <option key={c.id_movimiento} value={c.id_movimiento}>
                          {c.numero_documento_ref || `#${c.id_movimiento}`} —
                          Pend:{' '}
                          {formatMoney(c.saldo_pendiente, cuenta.moneda_simbolo)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Glosa / Descripción
                </label>
                <input
                  type="text"
                  required
                  value={movForm.glosa}
                  onChange={(e) =>
                    setMovForm({ ...movForm, glosa: e.target.value })
                  }
                  placeholder="Detalle del cargo o abono"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Aplicar Pago */}
      {aplicarModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Aplicar Abono a Cargo Pendiente
            </h3>
            {aplicarError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {aplicarError}
              </div>
            )}
            <form onSubmit={handleAplicarPago} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Abono Disponible
                </label>
                <select
                  required
                  value={aplicarForm.id_movimiento_abono}
                  onChange={(e) =>
                    setAplicarForm({
                      ...aplicarForm,
                      id_movimiento_abono: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {abonosDisponibles.map((a) => (
                    <option key={a.id_movimiento} value={a.id_movimiento}>
                      {a.numero_documento_ref || `#${a.id_movimiento}`} — Disp:{' '}
                      {formatMoney(a.saldo_pendiente, cuenta.moneda_simbolo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cargo Pendiente
                </label>
                <select
                  required
                  value={aplicarForm.id_movimiento_cargo}
                  onChange={(e) =>
                    setAplicarForm({
                      ...aplicarForm,
                      id_movimiento_cargo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {cargosPendientes.map((c) => (
                    <option key={c.id_movimiento} value={c.id_movimiento}>
                      {c.numero_documento_ref || `#${c.id_movimiento}`} — Pend:{' '}
                      {formatMoney(c.saldo_pendiente, cuenta.moneda_simbolo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Importe a Aplicar ({cuenta.moneda_simbolo})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={aplicarForm.monto_aplicado}
                  onChange={(e) =>
                    setAplicarForm({
                      ...aplicarForm,
                      monto_aplicado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAplicarModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                >
                  Aplicar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
