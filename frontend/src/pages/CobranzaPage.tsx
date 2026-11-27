import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  Link2,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CompromisoPago,
  CuentaCorriente,
  GestionCobranza,
} from '../types';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';
import {
  validarFechaIsoFrontend,
  validarImporteFrontend,
} from '../utils/validation';

interface DetalleGestionResp {
  gestion: GestionCobranza;
  interacciones: Array<{
    id_interaccion: number;
    fecha_interaccion: string;
    asunto: string;
    detalle: string;
    resultado: string | null;
    tipo_nombre: string;
    usuario_nombre: string;
  }>;
  interacciones_disponibles: Array<{
    id_interaccion: number;
    fecha_interaccion: string;
    asunto: string;
    tipo_nombre: string;
  }>;
  compromisos: CompromisoPago[];
  abonos_disponibles: Array<{
    id_movimiento: number;
    numero_documento_ref: string | null;
    fecha_movimiento: string;
    monto: string;
    glosa: string;
  }>;
}

export default function CobranzaPage() {
  const { usuario } = useAuth();
  const [gestiones, setGestiones] = useState<GestionCobranza[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCorriente[]>([]);
  const [usuarios, setUsuarios] = useState<
    Array<{ id_usuario: number; nombre_completo: string; rol: string }>
  >([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalle, setDetalle] = useState<DetalleGestionResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal abrir gestión
  const [modalGestion, setModalGestion] = useState(false);
  const [gestionForm, setGestionForm] = useState({
    id_cuenta: '',
    id_usuario_responsable: '',
    motivo: '',
  });

  // Modal nuevo compromiso
  const [modalCompromiso, setModalCompromiso] = useState(false);
  const [compForm, setCompForm] = useState({
    fecha_pactada: new Date().toISOString().slice(0, 10),
    monto_comprometido: '',
    observacion: '',
  });

  // Modal vincular abono
  const [modalAbono, setModalAbono] = useState<CompromisoPago | null>(null);
  const [idAbonoSeleccionado, setIdAbonoSeleccionado] = useState('');

  // Vincular interacción existente
  const [idInteraccionSel, setIdInteraccionSel] = useState('');

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargarLista = async () => {
    setLoading(true);
    try {
      const [gestRes, ctasRes, usrRes] = await Promise.all([
        api.get<{ gestiones: GestionCobranza[] }>('/cobranza', {
          params: { estado: filtroEstado || undefined },
        }),
        api.get<{ cuentas: CuentaCorriente[] }>('/cuentas'),
        api.get<{
          usuarios: Array<{
            id_usuario: number;
            nombre_completo: string;
            rol: string;
          }>;
        }>('/cobranza/usuarios'),
      ]);
      setGestiones(gestRes.data.gestiones);
      setCuentas(ctasRes.data.cuentas);
      setUsuarios(usrRes.data.usuarios);
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (idGestion: number) => {
    setError('');
    const { data } = await api.get<DetalleGestionResp>(
      `/cobranza/${idGestion}`
    );
    setDetalle(data);
    setIdInteraccionSel(
      data.interacciones_disponibles[0]
        ? String(data.interacciones_disponibles[0].id_interaccion)
        : ''
    );
  };

  useEffect(() => {
    cargarLista();
  }, [filtroEstado]);

  const abrirModalNuevaGestion = () => {
    setGestionForm({
      id_cuenta: cuentas[0] ? String(cuentas[0].id_cuenta) : '',
      id_usuario_responsable: usuario ? String(usuario.id_usuario) : '',
      motivo: '',
    });
    setError('');
    setModalGestion(true);
  };

  const handleCrearGestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post<{ gestion: GestionCobranza }>(
        '/cobranza',
        {
          id_cuenta: Number(gestionForm.id_cuenta),
          id_usuario_responsable: Number(gestionForm.id_usuario_responsable),
          motivo: gestionForm.motivo,
        }
      );
      setModalGestion(false);
      await cargarLista();
      await cargarDetalle(data.gestion.id_gestion);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al abrir gestión de cobranza.'
      );
    }
  };

  const handleCerrarGestion = async () => {
    if (!detalle) return;
    const obs = window.prompt('Observaciones de cierre (opcional):') || '';
    try {
      await api.patch(`/cobranza/${detalle.gestion.id_gestion}/cerrar`, {
        observaciones_cierre: obs,
      });
      await cargarLista();
      await cargarDetalle(detalle.gestion.id_gestion);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al cerrar la gestión.'
      );
    }
  };

  const handleVincularInteraccion = async () => {
    if (!detalle || !idInteraccionSel) return;
    setError('');
    try {
      await api.post(
        `/cobranza/${detalle.gestion.id_gestion}/vincular-interaccion`,
        { id_interaccion: Number(idInteraccionSel) }
      );
      await cargarLista();
      await cargarDetalle(detalle.gestion.id_gestion);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al vincular interacción.'
      );
    }
  };

  const [compError, setCompError] = useState('');
  const [submittingComp, setSubmittingComp] = useState(false);

  const handleCrearCompromiso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalle || submittingComp) return;
    setError('');
    setCompError('');

    const fechaCheck = validarFechaIsoFrontend(
      compForm.fecha_pactada,
      'La fecha pactada'
    );
    if (!fechaCheck.ok) {
      setCompError(fechaCheck.error);
      return;
    }

    const montoCheck = validarImporteFrontend(compForm.monto_comprometido, {
      campo: 'El monto comprometido',
      permitirCero: false,
    });
    if (!montoCheck.ok) {
      setCompError(montoCheck.error);
      return;
    }

    setSubmittingComp(true);
    try {
      await api.post(`/cobranza/${detalle.gestion.id_gestion}/compromisos`, {
        fecha_pactada: fechaCheck.valor,
        monto_comprometido: montoCheck.valor,
        observacion: compForm.observacion.trim() || null,
      });
      setModalCompromiso(false);
      await cargarLista();
      await cargarDetalle(detalle.gestion.id_gestion);
    } catch (err: unknown) {
      setCompError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al registrar compromiso de pago.'
      );
    } finally {
      setSubmittingComp(false);
    }
  };

  const handleVincularAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAbono || !detalle || !idAbonoSeleccionado) return;
    setError('');
    try {
      await api.patch(
        `/cobranza/compromisos/${modalAbono.id_compromiso}/vincular-abono`,
        { id_movimiento_abono: Number(idAbonoSeleccionado) }
      );
      setModalAbono(null);
      await cargarDetalle(detalle.gestion.id_gestion);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'No se pudo vincular el abono.'
      );
    }
  };

  const handleCancelarCompromiso = async (idCompromiso: number) => {
    if (!detalle || !window.confirm('¿Cancelar este compromiso de pago?')) {
      return;
    }
    setError('');
    try {
      await api.patch(`/cobranza/compromisos/${idCompromiso}/cancelar`);
      await cargarDetalle(detalle.gestion.id_gestion);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'No se pudo cancelar el compromiso.'
      );
    }
  };

  const badgeEstadoCompromiso = (estado: string) => {
    switch (estado) {
      case 'CUMPLIDO':
        return 'bg-emerald-100 text-emerald-700';
      case 'INCUMPLIDO':
        return 'bg-red-100 text-red-700';
      case 'CANCELADO':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Gestión de Cobranza
          </h2>
          <p className="text-sm text-slate-500">
            Casos de seguimiento por cuenta corriente, historial de interacciones
            y promesas de pago.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="ABIERTA">Abiertas</option>
            <option value="CERRADA">Cerradas</option>
          </select>
          {puedeEditar && (
            <button
              onClick={abrirModalNuevaGestion}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Abrir Gestión
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Tabla principal de gestiones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Cliente / Cuenta</th>
              <th className="px-4 py-3 text-right">Saldo Actual</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Cargando gestiones...
                </td>
              </tr>
            ) : gestiones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No hay gestiones de cobranza registradas.
                </td>
              </tr>
            ) : (
              gestiones.map((g) => (
                <tr
                  key={g.id_gestion}
                  className={
                    detalle?.gestion.id_gestion === g.id_gestion
                      ? 'bg-indigo-50/50'
                      : 'hover:bg-slate-50'
                  }
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {g.cliente_nombre}
                    </p>
                    <p className="text-xs font-mono text-slate-500">
                      {g.numero_cuenta}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(g.saldo_actual, g.moneda_simbolo)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{g.motivo}</p>
                    <p className="text-xs text-slate-400">
                      Apertura: {formatDateTime(g.fecha_apertura)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {g.responsable_nombre}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        g.estado === 'ABIERTA'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {g.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => cargarDetalle(g.id_gestion)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Panel de detalle de la gestión seleccionada */}
      {detalle && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Gestión #{detalle.gestion.id_gestion} —{' '}
                {detalle.gestion.cliente_nombre}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Cuenta: {detalle.gestion.numero_cuenta} · Saldo actual:{' '}
                <strong className="text-slate-800">
                  {formatMoney(
                    detalle.gestion.saldo_actual,
                    detalle.gestion.moneda_simbolo
                  )}
                </strong>{' '}
                · Responsable: {detalle.gestion.responsable_nombre}
              </p>
              <p className="text-sm text-slate-700 mt-2">
                <span className="font-medium">Motivo:</span>{' '}
                {detalle.gestion.motivo}
              </p>
              {detalle.gestion.observaciones_cierre && (
                <p className="text-xs text-slate-500 mt-1">
                  Cierre: {detalle.gestion.observaciones_cierre}
                </p>
              )}
            </div>

            {puedeEditar && detalle.gestion.estado === 'ABIERTA' && (
              <button
                onClick={handleCerrarGestion}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Cerrar Gestión
              </button>
            )}
          </div>

          {/* Compromisos de Pago */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">
                  Compromisos de Pago
                </h4>
                <p className="text-xs text-slate-500">
                  Registrar una promesa no modifica el saldo. Un abono parcial
                  por debajo del monto pactado mantiene el compromiso PENDIENTE
                  mientras esté dentro del plazo.
                </p>
              </div>
              {puedeEditar && detalle.gestion.estado === 'ABIERTA' && (
                <button
                  onClick={() => {
                    setCompForm({
                      fecha_pactada: new Date().toISOString().slice(0, 10),
                      monto_comprometido: '',
                      observacion: '',
                    });
                    setError('');
                    setModalCompromiso(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo Compromiso
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Fecha Pactada</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Observación / Abono Vinculado</th>
                    {puedeEditar && (
                      <th className="px-3 py-2 text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detalle.compromisos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        No hay compromisos registrados en esta gestión.
                      </td>
                    </tr>
                  ) : (
                    detalle.compromisos.map((cp) => (
                      <tr key={cp.id_compromiso}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(cp.fecha_pactada)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatMoney(
                            cp.monto_comprometido,
                            detalle.gestion.moneda_simbolo
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${badgeEstadoCompromiso(
                              cp.estado_efectivo
                            )}`}
                          >
                            {cp.estado_efectivo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {cp.observacion && <p>{cp.observacion}</p>}
                          {cp.id_movimiento_abono && (
                            <p className="text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Abono{' '}
                              {cp.abono_documento_ref ||
                                `#${cp.id_movimiento_abono}`}{' '}
                              (
                              {formatMoney(
                                cp.abono_monto || 0,
                                detalle.gestion.moneda_simbolo
                              )}
                              , {formatDate(cp.abono_fecha)})
                            </p>
                          )}
                        </td>
                        {puedeEditar && (
                          <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                            {(cp.estado_efectivo === 'PENDIENTE' ||
                              cp.estado_efectivo === 'INCUMPLIDO') &&
                              detalle.abonos_disponibles.length > 0 && (
                                <button
                                  onClick={() => {
                                    setModalAbono(cp);
                                    setIdAbonoSeleccionado(
                                      String(
                                        detalle.abonos_disponibles[0]
                                          .id_movimiento
                                      )
                                    );
                                    setError('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded cursor-pointer"
                                  title="Vincular abono efectivo"
                                >
                                  <Link2 className="w-3 h-3" />
                                  Vincular abono
                                </button>
                              )}
                            {cp.estado_efectivo !== 'CUMPLIDO' &&
                              cp.estado_efectivo !== 'CANCELADO' && (
                                <button
                                  onClick={() =>
                                    handleCancelarCompromiso(cp.id_compromiso)
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                  title="Cancelar compromiso"
                                >
                                  <XCircle className="w-3 h-3" />
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

          {/* Interacciones vinculadas */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                Interacciones Vinculadas al Caso
              </h4>
              {puedeEditar && detalle.interacciones_disponibles.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={idInteraccionSel}
                    onChange={(e) => setIdInteraccionSel(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {detalle.interacciones_disponibles.map((i) => (
                      <option key={i.id_interaccion} value={i.id_interaccion}>
                        {formatDate(i.fecha_interaccion)} · {i.tipo_nombre}:{' '}
                        {i.asunto}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleVincularInteraccion}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs rounded-lg cursor-pointer"
                  >
                    Vincular Interacción
                  </button>
                </div>
              )}
            </div>

            {detalle.interacciones.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay interacciones vinculadas a esta gestión.
              </p>
            ) : (
              <div className="space-y-2">
                {detalle.interacciones.map((i) => (
                  <div
                    key={i.id_interaccion}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  >
                    <p className="font-medium text-slate-900">
                      {i.tipo_nombre} · {i.asunto}{' '}
                      <span className="text-slate-400 font-normal">
                        ({formatDateTime(i.fecha_interaccion)} —{' '}
                        {i.usuario_nombre})
                      </span>
                    </p>
                    <p className="text-slate-600 mt-1">{i.detalle}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Abrir Gestión */}
      {modalGestion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Abrir Gestión de Cobranza
            </h3>
            <form onSubmit={handleCrearGestion} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cuenta Corriente
                </label>
                <select
                  required
                  value={gestionForm.id_cuenta}
                  onChange={(e) =>
                    setGestionForm({
                      ...gestionForm,
                      id_cuenta: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {cuentas.map((c) => (
                    <option key={c.id_cuenta} value={c.id_cuenta}>
                      {c.numero_cuenta} — {c.cliente_nombre} (
                      {formatMoney(c.saldo_actual, c.moneda_simbolo)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Responsable
                </label>
                <select
                  required
                  value={gestionForm.id_usuario_responsable}
                  onChange={(e) =>
                    setGestionForm({
                      ...gestionForm,
                      id_usuario_responsable: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {usuarios.map((u) => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre_completo} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Motivo de seguimiento
                </label>
                <input
                  type="text"
                  required
                  value={gestionForm.motivo}
                  onChange={(e) =>
                    setGestionForm({ ...gestionForm, motivo: e.target.value })
                  }
                  placeholder="Ej. Factura vencida con saldo pendiente"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalGestion(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Abrir Gestión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Compromiso */}
      {modalCompromiso && detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Registrar Compromiso de Pago
            </h3>
            {compError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {compError}
              </div>
            )}
            <form noValidate onSubmit={handleCrearCompromiso} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha Pactada
                  </label>
                  <input
                    type="date"
                    required
                    value={compForm.fecha_pactada}
                    onChange={(e) =>
                      setCompForm({
                        ...compForm,
                        fecha_pactada: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Monto ({detalle.gestion.moneda_simbolo})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={compForm.monto_comprometido}
                    onChange={(e) =>
                      setCompForm({
                        ...compForm,
                        monto_comprometido: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Observación
                </label>
                <textarea
                  rows={2}
                  value={compForm.observacion}
                  onChange={(e) =>
                    setCompForm({ ...compForm, observacion: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCompromiso(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingComp}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
                >
                  {submittingComp ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vincular Abono */}
      {modalAbono && detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Vincular Abono al Compromiso
            </h3>
            <p className="text-xs text-slate-600">
              Compromiso de{' '}
              <strong>
                {formatMoney(
                  modalAbono.monto_comprometido,
                  detalle.gestion.moneda_simbolo
                )}
              </strong>{' '}
              hasta {formatDate(modalAbono.fecha_pactada)}.
            </p>
            <form onSubmit={handleVincularAbono} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Abono Efectivo de la Cuenta
                </label>
                <select
                  required
                  value={idAbonoSeleccionado}
                  onChange={(e) => setIdAbonoSeleccionado(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {detalle.abonos_disponibles.map((a) => (
                    <option key={a.id_movimiento} value={a.id_movimiento}>
                      {a.numero_documento_ref || `#${a.id_movimiento}`} —{' '}
                      {formatMoney(a.monto, detalle.gestion.moneda_simbolo)} (
                      {formatDate(a.fecha_movimiento)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbono(null)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                >
                  Vincular y Cumplir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
