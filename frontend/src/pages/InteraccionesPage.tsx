import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cliente, InteraccionCliente } from '../types';
import { formatDate, formatDateTime } from '../utils/format';

export default function InteraccionesPage() {
  const { catalogos, usuario } = useAuth();
  const [interacciones, setInteracciones] = useState<InteraccionCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    id_cliente: '',
    id_tipo_interaccion: '',
    asunto: '',
    detalle: '',
    resultado: '',
    fecha_proximo_seguimiento: '',
  });

  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'ANALISTA';

  const cargar = async () => {
    const [intRes, cliRes] = await Promise.all([
      api.get<{ interacciones: InteraccionCliente[] }>('/interacciones', {
        params: { id_cliente: filtroCliente || undefined },
      }),
      api.get<{ clientes: Cliente[] }>('/clientes'),
    ]);
    setInteracciones(intRes.data.interacciones);
    setClientes(cliRes.data.clientes);
  };

  useEffect(() => {
    cargar();
  }, [filtroCliente]);

  const abrirModal = () => {
    setForm({
      id_cliente: clientes[0] ? String(clientes[0].id_cliente) : '',
      id_tipo_interaccion: catalogos?.tiposInteraccion[0]
        ? String(catalogos.tiposInteraccion[0].id_tipo_interaccion)
        : '',
      asunto: '',
      detalle: '',
      resultado: '',
      fecha_proximo_seguimiento: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/interacciones', {
      ...form,
      id_cliente: Number(form.id_cliente),
      id_tipo_interaccion: Number(form.id_tipo_interaccion),
      fecha_proximo_seguimiento: form.fecha_proximo_seguimiento || null,
    });
    setModalOpen(false);
    await cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Historial de Interacciones y Seguimiento
          </h2>
          <p className="text-sm text-slate-500">
            Bitácora de llamadas, correos, reuniones y compromisos de pago.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.nombre_display}
              </option>
            ))}
          </select>
          {puedeEditar && (
            <button
              onClick={abrirModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Interacción
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {interacciones.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
            No hay interacciones registradas.
          </div>
        ) : (
          interacciones.map((i) => (
            <div
              key={i.id_interaccion}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                    <MessageSquare className="w-3 h-3" />
                    {i.tipo_nombre}
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {i.cliente_nombre}
                  </span>
                  <span className="text-xs text-slate-400">
                    · {formatDateTime(i.fecha_interaccion)}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">{i.asunto}</p>
                <p className="text-sm text-slate-600">{i.detalle}</p>
                <p className="text-xs text-slate-500">
                  Registrado por: {i.usuario_nombre}
                  {i.resultado ? ` · Resultado: ${i.resultado}` : ''}
                </p>
              </div>
              {i.fecha_proximo_seguimiento && (
                <div className="shrink-0 text-right">
                  <span className="text-xs text-slate-500 block">
                    Próximo seguimiento
                  </span>
                  <span className="inline-block mt-0.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 text-xs font-semibold">
                    {formatDate(i.fecha_proximo_seguimiento)}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Nueva Interacción con Cliente
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cliente
                </label>
                <select
                  required
                  value={form.id_cliente}
                  onChange={(e) =>
                    setForm({ ...form, id_cliente: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.razon_social}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Canal / Tipo
                  </label>
                  <select
                    required
                    value={form.id_tipo_interaccion}
                    onChange={(e) =>
                      setForm({ ...form, id_tipo_interaccion: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {catalogos?.tiposInteraccion.map((t) => (
                      <option
                        key={t.id_tipo_interaccion}
                        value={t.id_tipo_interaccion}
                      >
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Próximo Seguimiento
                  </label>
                  <input
                    type="date"
                    value={form.fecha_proximo_seguimiento}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fecha_proximo_seguimiento: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  required
                  value={form.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Detalle
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.detalle}
                  onChange={(e) =>
                    setForm({ ...form, detalle: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Resultado
                </label>
                <input
                  type="text"
                  value={form.resultado}
                  onChange={(e) =>
                    setForm({ ...form, resultado: e.target.value })
                  }
                  placeholder="Ej. COMPROMISO_PAGO, CONTACTADO"
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
