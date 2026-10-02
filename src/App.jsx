import { useState, useEffect, useRef } from 'react';
import { Mic, Check, Plus, Pencil, Trash2, X, Save, Undo2, Archive, ChefHat, Clock } from 'lucide-react';

const PEDIDOS_INICIALES = [
  { id: 1, cliente: 'María López', items: '2 Brownies de Chocolate, 1 Pie de Limón', total: 850, estado: 'pendiente', hora: '12:30 PM' },
  { id: 2, cliente: 'Carlos Gomez', items: '1 Torta Red Velvet Grande', total: 1200, estado: 'listo', hora: '01:15 PM' },
];

const cargarPedidos = () => {
  try {
    const guardado = localStorage.getItem('chefnote_pedidos');
    return guardado ? JSON.parse(guardado) : PEDIDOS_INICIALES;
  } catch {
    return PEDIDOS_INICIALES;
  }
};

const formatoMonto = (n) => `$${Number(n || 0).toLocaleString('es-DO')}`;
const lineas = (texto) => texto.split(/\s*,\s*/).filter(Boolean);

// Extrae monto y cliente del texto dictado
const analizarDictado = (texto) => {
  const matchMonto = texto.match(/(\d[\d.,]*)\s*(?:pesos|peso|\$)/i) || texto.match(/\$\s*(\d[\d.,]*)/);
  const monto = matchMonto ? matchMonto[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.') : '';
  const matchCliente = texto.match(/\bpara\s+([^,.\d]+?)(?=\s+(?:con|de|y|por)\b|[,.\d]|$)/i);
  return { monto, cliente: matchCliente ? matchCliente[1].trim() : '' };
};

const limpiarMonto = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'pendiente', etiqueta: 'Pendientes' },
  { id: 'listo', etiqueta: 'Listos' },
];

const campo =
  'w-full rounded-xl border border-borde bg-tinta/60 px-4 py-3 text-base text-harina placeholder:text-niebla/60 transition-colors focus:border-mantequilla focus:outline-none';
const boton = 'grid size-11 shrink-0 place-items-center rounded-xl border transition-colors';

export default function App() {
  const [pedidos, setPedidos] = useState(cargarPedidos);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [cliente, setCliente] = useState('');
  const [items, setItems] = useState('');
  const [monto, setMonto] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [aviso, setAviso] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const reconocimientoRef = useRef(null);
  const formularioRef = useRef(null);
  const avisoTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('chefnote_pedidos', JSON.stringify(pedidos));
    } catch {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando */
    }
  }, [pedidos]);

  useEffect(() => () => {
    reconocimientoRef.current?.stop();
    clearTimeout(avisoTimer.current);
  }, []);

  useEffect(() => {
    if (!confirmacion) return;
    const alTeclear = (e) => e.key === 'Escape' && setConfirmacion(null);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [confirmacion]);

  const avisar = (texto, accion) => {
    clearTimeout(avisoTimer.current);
    setAviso({ texto, accion });
    avisoTimer.current = setTimeout(() => setAviso(null), accion ? 5000 : 2600);
  };

  const alternarMicrofono = () => {
    if (escuchando) {
      reconocimientoRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      avisar('Este navegador no permite dictar. Usa Chrome o Edge, o anota el pedido abajo.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-DO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const texto = event.results[0][0].transcript;
      const dato = analizarDictado(texto);
      setTranscripcion(texto);
      setItems(texto);
      if (dato.monto) setMonto(dato.monto);
      setCliente(dato.cliente || 'Cliente dictado');
    };
    recognition.onerror = (e) => {
      setEscuchando(false);
      if (e.error === 'not-allowed') avisar('Permite el micrófono en el navegador para dictar.');
    };
    recognition.onend = () => {
      setEscuchando(false);
      reconocimientoRef.current = null;
    };
    reconocimientoRef.current = recognition;
    setEscuchando(true);
    try {
      recognition.start();
    } catch {
      setEscuchando(false);
    }
  };

  const limpiarFormulario = () => {
    setCliente('');
    setItems('');
    setMonto('');
    setTranscripcion('');
    setEditandoId(null);
  };

  const guardarPedido = (e) => {
    e.preventDefault();
    if (!items.trim()) return;
    const datos = { cliente: cliente.trim() || 'Cliente general', items: items.trim(), total: Number(monto) || 0 };
    if (editandoId) {
      setPedidos((prev) => prev.map((p) => (p.id === editandoId ? { ...p, ...datos } : p)));
      avisar('Pedido actualizado');
    } else {
      const nuevo = {
        id: Date.now(),
        ...datos,
        estado: 'pendiente',
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setPedidos((prev) => [nuevo, ...prev]);
      setFiltro((f) => (f === 'listo' ? 'todos' : f));
      avisar('Pedido guardado');
    }
    limpiarFormulario();
  };

  const empezarEdicion = (p) => {
    setEditandoId(p.id);
    setCliente(p.cliente);
    setItems(p.items);
    setMonto(String(p.total));
    setTranscripcion('');
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cambiarEstado = (id) =>
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estado: p.estado === 'pendiente' ? 'listo' : 'pendiente' } : p))
    );

  const eliminarPedido = (pedido) => {
    const indice = pedidos.findIndex((p) => p.id === pedido.id);
    if (pedido.id === editandoId) limpiarFormulario();
    setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
    avisar('Pedido eliminado', {
      etiqueta: 'Deshacer',
      fn: () => {
        setPedidos((prev) => {
          const copia = [...prev];
          copia.splice(Math.min(indice, copia.length), 0, pedido);
          return copia;
        });
        setAviso(null);
      },
    });
  };

  const pedirCierre = () => {
    const listos = pedidos.filter((p) => p.estado === 'listo').length;
    if (!listos) {
      avisar('Todavía no hay pedidos listos para cerrar');
      return;
    }
    setConfirmacion({
      titulo: 'Cerrar el día',
      texto: `Se archivarán ${listos} pedido${listos > 1 ? 's' : ''} listo${listos > 1 ? 's' : ''} y las ventas volverán a $0. Los pendientes se quedan.`,
      accion: () => {
        if (pedidos.find((p) => p.id === editandoId)?.estado === 'listo') limpiarFormulario();
        setPedidos((prev) => prev.filter((p) => p.estado !== 'listo'));
        setConfirmacion(null);
        avisar('Día cerrado');
      },
    });
  };

  const totalVentas = pedidos.filter((p) => p.estado === 'listo').reduce((acc, p) => acc + p.total, 0);
  const cuenta = {
    todos: pedidos.length,
    pendiente: pedidos.filter((p) => p.estado === 'pendiente').length,
    listo: pedidos.filter((p) => p.estado === 'listo').length,
  };
  const visibles = filtro === 'todos' ? pedidos : pedidos.filter((p) => p.estado === filtro);
  const fecha = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* Encabezado */}
      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-mantequilla text-tinta">
            <ChefHat size={26} strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold leading-none tracking-tight">
              ChefNote <span className="font-light text-niebla">Express</span>
            </h1>
            <p className="mt-1.5 text-sm text-niebla first-letter:uppercase">{fecha}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-niebla">Ventas del día</p>
          <p className="text-2xl font-bold tabular-nums text-mantequilla">{formatoMonto(totalVentas)}</p>
        </div>
      </header>

      {/* Dictado */}
      <section className="mb-8 flex flex-col items-center text-center" aria-label="Dictar pedido">
        <button
          type="button"
          onClick={alternarMicrofono}
          aria-pressed={escuchando}
          aria-label={escuchando ? 'Terminar dictado' : 'Dictar pedido'}
          className={`relative grid size-24 place-items-center rounded-full transition-colors ${
            escuchando ? 'bg-frambuesa text-white' : 'bg-mantequilla text-tinta hover:bg-[#f6cf72]'
          }`}
        >
          {escuchando && (
            <>
              <span className="anillo absolute inset-0 rounded-full bg-frambuesa" />
              <span className="anillo anillo-2 absolute inset-0 rounded-full bg-frambuesa" />
            </>
          )}
          <Mic size={36} strokeWidth={2.2} className="relative" />
        </button>
        <p className="mt-4 max-w-sm text-sm text-niebla">
          {escuchando ? 'Escuchando… toca para terminar' : 'Toca y di: “dos brownies para Ana, 850 pesos”'}
        </p>
        {transcripcion && <p className="mt-2 max-w-md text-base italic text-harina">“{transcripcion}”</p>}
      </section>

      {/* Formulario */}
      <form
        ref={formularioRef}
        onSubmit={guardarPedido}
        className={`mb-10 rounded-2xl border bg-panel p-5 transition-colors ${
          editandoId ? 'border-mantequilla' : 'border-borde'
        }`}
      >
        <h2 className="mb-4 text-lg font-semibold">{editandoId ? 'Editar pedido' : 'Nuevo pedido'}</h2>
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-niebla">Cliente</span>
            <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ana" className={campo} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-niebla">Pedido</span>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              required
              placeholder="2 brownies, 1 pie de limón"
              className={campo}
            />
          </label>
          <div className="flex items-end gap-3">
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm text-niebla">Monto</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-niebla">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(limpiarMonto(e.target.value))}
                  placeholder="0"
                  className={`${campo} pl-8 tabular-nums`}
                />
              </span>
            </label>
            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="flex h-12 items-center gap-1.5 rounded-xl border border-borde px-4 font-semibold text-harina transition-colors hover:bg-white/5"
              >
                <X size={18} /> Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex h-12 items-center gap-1.5 rounded-xl bg-mantequilla px-5 font-bold text-tinta transition-colors hover:bg-[#f6cf72]"
            >
              {editandoId ? <Save size={18} /> : <Plus size={18} />} {editandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>

      {/* Comandas */}
      <section aria-label="Pedidos">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex rounded-xl bg-panel p-1" role="tablist" aria-label="Filtrar pedidos">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  filtro === f.id ? 'bg-harina text-tinta' : 'text-niebla hover:text-harina'
                }`}
              >
                {f.etiqueta} <span className="tabular-nums opacity-60">{cuenta[f.id]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={pedirCierre}
            className="flex items-center gap-1.5 rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-niebla transition-colors hover:bg-white/5 hover:text-harina"
          >
            <Archive size={16} /> Cerrar el día
          </button>
        </div>

        {visibles.length === 0 && (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-borde px-6 py-12 text-center">
            <ChefHat size={32} className="text-niebla" />
            <p className="text-niebla">
              {pedidos.length === 0 ? 'Cocina tranquila. Dicta o anota el primer pedido.' : 'No hay pedidos en esta lista.'}
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-4">
          {visibles.map((p) => {
            const listo = p.estado === 'listo';
            const sepBorde = listo ? 'border-borde' : 'border-tinta/25';
            const btnSuave = listo
              ? 'border-borde text-niebla hover:bg-white/5'
              : 'border-tinta/20 text-tinta hover:bg-tinta/5';
            return (
              <li
                key={p.id}
                className={`relative rounded-2xl ${listo ? 'bg-panel text-niebla' : 'bg-harina text-tinta'} ${
                  p.id === editandoId ? 'ring-2 ring-mantequilla ring-offset-2 ring-offset-tinta' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <h3 className={`text-lg font-bold leading-tight ${listo ? 'text-harina' : ''}`}>{p.cliente}</h3>
                  <span className="flex shrink-0 items-center gap-1 pt-0.5 text-sm tabular-nums opacity-70">
                    <Clock size={13} /> {p.hora}
                  </span>
                </div>

                {/* Perforado de la comanda */}
                <div className="relative">
                  <div className={`border-t border-dashed ${sepBorde}`} />
                  <span className="absolute -left-2 -top-2 size-4 rounded-full bg-tinta" />
                  <span className="absolute -right-2 -top-2 size-4 rounded-full bg-tinta" />
                </div>

                <ul className="space-y-1 px-4 pb-3 pt-3.5">
                  {lineas(p.items).map((linea, i) => (
                    <li key={i} className={`text-base ${listo ? 'line-through decoration-niebla/40' : ''}`}>
                      {linea}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between gap-3 px-4 pb-4">
                  <span className={`text-xl font-extrabold tabular-nums ${listo ? 'text-pistacho' : ''}`}>
                    {formatoMonto(p.total)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cambiarEstado(p.id)}
                      title={listo ? 'Volver a pendiente' : 'Marcar como listo'}
                      aria-label={listo ? 'Volver a pendiente' : 'Marcar como listo'}
                      className={`${boton} ${
                        listo ? 'border-pistacho/40 bg-pistacho/10 text-pistacho hover:bg-pistacho/20' : 'border-tinta bg-tinta text-pistacho hover:bg-panel'
                      }`}
                    >
                      {listo ? <Undo2 size={20} /> : <Check size={22} strokeWidth={2.6} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => empezarEdicion(p)}
                      title="Editar pedido"
                      aria-label="Editar pedido"
                      className={`${boton} ${btnSuave}`}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarPedido(p)}
                      title="Eliminar pedido"
                      aria-label="Eliminar pedido"
                      className={`${boton} ${btnSuave} hover:!text-frambuesa`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Aviso */}
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className="aparecer fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-borde bg-panel px-4 py-3 text-sm shadow-xl shadow-black/40"
        >
          <span>{aviso.texto}</span>
          {aviso.accion && (
            <button type="button" onClick={aviso.accion.fn} className="font-bold text-mantequilla hover:underline">
              {aviso.accion.etiqueta}
            </button>
          )}
        </div>
      )}

      {/* Confirmación */}
      {confirmacion && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-tinta/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmacion(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacion"
            onClick={(e) => e.stopPropagation()}
            className="aparecer w-full max-w-sm rounded-2xl border border-borde bg-panel p-6 shadow-2xl shadow-black/50"
          >
            <h2 id="titulo-confirmacion" className="text-lg font-bold">{confirmacion.titulo}</h2>
            <p className="mt-2 text-niebla">{confirmacion.texto}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmacion(null)}
                className="rounded-xl border border-borde px-4 py-2.5 font-semibold transition-colors hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmacion.accion}
                className="rounded-xl bg-mantequilla px-4 py-2.5 font-bold text-tinta transition-colors hover:bg-[#f6cf72]"
              >
                Cerrar el día
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
