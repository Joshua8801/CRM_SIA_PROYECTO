import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, AlertCircle, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cliente, TipoPersona } from '../types';
import { formatMoney } from '../utils/format';

export default function ClientesPage() {
  const { catalogos, usuario } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [idSegmento, setIdSegmento] = useState('');
  const [tipoPersonaFiltro, setTipoPersonaFiltro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [error, setError] = useState('');

  // Modal abrir cuenta adicional (PEN/USD)
  const [modalCuentaCliente, setModalCuentaCliente] = useState<Cliente | null>(
    null
  );
  const [cuentaForm, setCuentaForm] = useState({
    id_tipo_moneda: '',
    linea_credito: '',
  });
  const [cuentaError, setCuentaError] = useState('');

  const [form, setForm] = useState({
    tipo_persona: 'JURIDICA' as TipoPersona,
    id_tipo_documento: '',
    numero_documento: '',
    nombre_completo: '',
    razon_social: '',
    nombre_comercial: '',
    id_segmento: '',
    id_tipo_moneda: '',
    email: '',
    telefono: '',
    direccion: '',
    linea_credito: '',
    estado: 'ACTIVO' as 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO',
  });

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (idSegmento) params.id_segmento = idSegmento;
      if (tipoPersonaFiltro) params.tipo_persona = tipoPersonaFiltro;
      const { data } = await api.get<{ clientes: Cliente[] }>('/clientes', {
        params,
      });
      setClientes(data.clientes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, [idSegmento, tipoPersonaFiltro]);

  const abrirNuevo = () => {
    setEditando(null);
    const primerDoc = catalogos?.tiposDocumento[0]?.id_tipo_documento || '';
    const primerSeg = catalogos?.segmentos[0];
    const monedaPen =
      catalogos?.tiposMoneda.find((m) => m.codigo === 'PEN') ||
      catalogos?.tiposMoneda[0];
    setForm({
      tipo_persona: 'JURIDICA',
      id_tipo_documento: String(primerDoc),
      numero_documento: '',
      nombre_completo: '',
      razon_social: '',
      nombre_comercial: '',
      id_segmento: primerSeg ? String(primerSeg.id_segmento) : '',
      id_tipo_moneda: monedaPen ? String(monedaPen.id_tipo_moneda) : '',
      email: '',
      telefono: '',
      direccion: '',
      linea_credito: primerSeg ? primerSeg.linea_credito_sugerida : '5000',
      estado: 'ACTIVO',
    });
    setError('');
    setModalOpen(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditando(c);
    const primeraCuenta = c.cuentas_resumen?.[0];
    setForm({
      tipo_persona: c.tipo_persona,
      id_tipo_documento: String(c.id_tipo_documento),
      numero_documento: c.numero_documento,
      nombre_completo: c.nombre_completo || '',
      razon_social: c.razon_social || '',
      nombre_comercial: c.nombre_comercial || '',
      id_segmento: String(c.id_segmento),
      id_tipo_moneda: primeraCuenta
        ? String(primeraCuenta.id_tipo_moneda)
        : '',
      email: c.email || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      linea_credito: primeraCuenta ? primeraCuenta.linea_credito : '0',
      estado: c.estado,
    });
    setError('');
    setModalOpen(true);
  };

  const abrirModalNuevaCuenta = (c: Cliente) => {
    const monedaFaltante =
      catalogos?.tiposMoneda.find(
        (m) =>
          !c.cuentas_resumen?.some((cr) => cr.id_tipo_moneda === m.id_tipo_moneda)
      ) || catalogos?.tiposMoneda[0];
    const seg = catalogos?.segmentos.find(
      (s) => s.id_segmento === c.id_segmento
    );
    setModalCuentaCliente(c);
    setCuentaForm({
      id_tipo_moneda: monedaFaltante
        ? String(monedaFaltante.id_tipo_moneda)
        : '',
      linea_credito: seg ? seg.linea_credito_sugerida : '5000',
    });
    setCuentaError('');
  };

  const handleSegmentoChange = (segId: string) => {
    const seg = catalogos?.segmentos.find(
      (s) => String(s.id_segmento) === segId
    );
    setForm((prev) => ({
      ...prev,
      id_segmento: segId,
      linea_credito:
        !editando && seg ? seg.linea_credito_sugerida : prev.linea_credito,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        tipo_persona: form.tipo_persona,
        id_tipo_documento: Number(form.id_tipo_documento),
        numero_documento: form.numero_documento,
        nombre_completo:
          form.tipo_persona === 'NATURAL' ? form.nombre_completo : null,
        razon_social:
          form.tipo_persona === 'JURIDICA' ? form.razon_social : null,
        nombre_comercial: form.nombre_comercial || null,
        id_segmento: Number(form.id_segmento),
        id_tipo_moneda: form.id_tipo_moneda
          ? Number(form.id_tipo_moneda)
          : undefined,
        email: form.email || null,
        telefono: form.telefono || null,
        direccion: form.direccion || null,
        linea_credito: Number(form.linea_credito || 0),
        estado: form.estado,
      };
      if (editando) {
        await api.put(`/clientes/${editando.id_cliente}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      setModalOpen(false);
      await cargarClientes();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error al guardar cliente.'
      );
    }
  };

  const handleAbrirCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCuentaCliente) return;
    setCuentaError('');
    try {
      await api.post(`/clientes/${modalCuentaCliente.id_cliente}/cuentas`, {
        id_tipo_moneda: Number(cuentaForm.id_tipo_moneda),
        linea_credito: Number(cuentaForm.linea_credito || 0),
      });
      setModalCuentaCliente(null);
      await cargarClientes();
    } catch (err: unknown) {
      setCuentaError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'No se pudo abrir la cuenta.'
      );
    }
  };

  const monedaFormSeleccionada = catalogos?.tiposMoneda.find(
    (m) => String(m.id_tipo_moneda) === form.id_tipo_moneda
  );
  const monedaCuentaSeleccionada = catalogos?.tiposMoneda.find(
    (m) => String(m.id_tipo_moneda) === cuentaForm.id_tipo_moneda
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Clientes y Segmentación
          </h2>
          <p className="text-sm text-slate-500">
            Registro de personas naturales y jurídicas, segmento comercial y
            cuentas por moneda (PEN / USD).
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={abrirNuevo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargarClientes()}
            placeholder="Buscar por nombre, razón social o documento..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={tipoPersonaFiltro}
          onChange={(e) => setTipoPersonaFiltro(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="NATURAL">Persona Natural</option>
          <option value="JURIDICA">Persona Jurídica</option>
        </select>
        <select
          value={idSegmento}
          onChange={(e) => setIdSegmento(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos los segmentos</option>
          {catalogos?.segmentos.map((s) => (
            <option key={s.id_segmento} value={s.id_segmento}>
              {s.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={cargarClientes}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm rounded-lg cursor-pointer"
        >
          Buscar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3 text-right">Línea Crédito</th>
              <th className="px-4 py-3 text-right">Saldo Calculado</th>
              <th className="px-4 py-3">Estado</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando clientes...
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No se encontraron clientes.
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id_cliente} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-semibold text-slate-500 mr-1">
                      {c.tipo_documento_codigo}
                    </span>
                    <span className="font-mono text-slate-800">
                      {c.numero_documento}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {c.nombre_display}
                    </p>
                    {c.email && (
                      <p className="text-xs text-slate-500">{c.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                      {c.tipo_persona}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                      {c.segmento_nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium space-y-1">
                    {c.cuentas_resumen?.length ? (
                      c.cuentas_resumen.map((cc) => (
                        <div key={cc.id_cuenta} className="whitespace-nowrap">
                          <span className="text-[11px] text-slate-400 mr-1">
                            {cc.moneda_codigo}
                          </span>
                          {formatMoney(cc.linea_credito, cc.moneda_simbolo)}
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-y-1">
                    {c.cuentas_resumen?.length ? (
                      c.cuentas_resumen.map((cc) => (
                        <div key={cc.id_cuenta} className="whitespace-nowrap">
                          <Link
                            to={`/cuentas/${cc.id_cuenta}`}
                            className={`font-semibold inline-flex items-center gap-1 hover:underline ${
                              cc.excede_linea ? 'text-red-600' : 'text-slate-900'
                            }`}
                          >
                            {cc.excede_linea && (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            {formatMoney(cc.saldo_actual, cc.moneda_simbolo)}
                          </Link>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.estado === 'ACTIVO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : c.estado === 'BLOQUEADO'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c.estado}
                    </span>
                  </td>
                  {puedeEditar && (
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => abrirModalNuevaCuenta(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded cursor-pointer"
                        title="Abrir cuenta en otra moneda"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Abrir cuenta
                      </button>
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                        title="Editar cliente"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear / Editar Cliente */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">
              {editando ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
            </h3>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Persona
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['JURIDICA', 'NATURAL'] as TipoPersona[]).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setForm({ ...form, tipo_persona: tp })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                        form.tipo_persona === tp
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tp === 'JURIDICA'
                        ? 'Persona Jurídica'
                        : 'Persona Natural'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tipo Documento
                  </label>
                  <select
                    disabled={!!editando}
                    value={form.id_tipo_documento}
                    onChange={(e) =>
                      setForm({ ...form, id_tipo_documento: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100"
                  >
                    {catalogos?.tiposDocumento.map((d) => (
                      <option
                        key={d.id_tipo_documento}
                        value={d.id_tipo_documento}
                      >
                        {d.codigo} - {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número Documento
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editando}
                    value={form.numero_documento}
                    onChange={(e) =>
                      setForm({ ...form, numero_documento: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100"
                  />
                </div>
              </div>

              {form.tipo_persona === 'NATURAL' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre Completo (Persona Natural) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre_completo}
                    onChange={(e) =>
                      setForm({ ...form, nombre_completo: e.target.value })
                    }
                    placeholder="Ej. María Elena Quispe Torres"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Razón Social (Persona Jurídica) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.razon_social}
                    onChange={(e) =>
                      setForm({ ...form, razon_social: e.target.value })
                    }
                    placeholder="Ej. Comercializadora Andina S.A.C."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Segmento
                  </label>
                  <select
                    value={form.id_segmento}
                    onChange={(e) => handleSegmentoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {catalogos?.segmentos.map((s) => (
                      <option key={s.id_segmento} value={s.id_segmento}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {!editando && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Moneda Cuenta Inicial
                    </label>
                    <select
                      value={form.id_tipo_moneda}
                      onChange={(e) =>
                        setForm({ ...form, id_tipo_moneda: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {catalogos?.tiposMoneda.map((m) => (
                        <option key={m.id_tipo_moneda} value={m.id_tipo_moneda}>
                          {m.codigo} ({m.simbolo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={editando ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Línea de Crédito ({monedaFormSeleccionada?.simbolo || 'S/'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.linea_credito}
                    onChange={(e) =>
                      setForm({ ...form, linea_credito: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Correo
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({ ...form, direccion: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {editando && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={form.estado}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estado: e.target.value as
                          | 'ACTIVO'
                          | 'BLOQUEADO'
                          | 'INACTIVO',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}

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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abrir Cuenta en Otra Moneda */}
      {modalCuentaCliente && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Abrir Cuenta Corriente
            </h3>
            <p className="text-xs text-slate-600">
              Cliente: <strong>{modalCuentaCliente.nombre_display}</strong>
            </p>
            {cuentaError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {cuentaError}
              </div>
            )}
            <form onSubmit={handleAbrirCuenta} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Moneda
                </label>
                <select
                  required
                  value={cuentaForm.id_tipo_moneda}
                  onChange={(e) =>
                    setCuentaForm({
                      ...cuentaForm,
                      id_tipo_moneda: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {catalogos?.tiposMoneda.map((m) => (
                    <option key={m.id_tipo_moneda} value={m.id_tipo_moneda}>
                      {m.codigo} - {m.nombre} ({m.simbolo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Línea de Crédito ({monedaCuentaSeleccionada?.simbolo || 'S/'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={cuentaForm.linea_credito}
                  onChange={(e) =>
                    setCuentaForm({
                      ...cuentaForm,
                      linea_credito: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCuentaCliente(null)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Abrir Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
