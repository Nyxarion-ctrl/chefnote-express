import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Plus, Check, Clock, Trash2, ShoppingBag, ChefHat } from 'lucide-react';

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

// Extrae monto y cliente del texto dictado
const analizarDictado = (texto) => {
  // Monto: número pegado a "pesos" o "$" (acepta 1,200 o 1.200)
  const matchMonto =
    texto.match(/(\d[\d.,]*)\s*(?:pesos|peso|\$)/i) || texto.match(/\$\s*(\d[\d.,]*)/);
  const monto = matchMonto ? matchMonto[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.') : '';

  // Cliente: "para Juan", "para María López"
  const matchCliente = texto.match(/\bpara\s+([^,.\d]+?)(?=\s+(?:con|de|y|por)\b|[,.\d]|$)/i);
  const cliente = matchCliente ? matchCliente[1].trim() : '';

  return { monto, cliente };
};

const campo =
  'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-base text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40';

export default function App() {
  const [pedidos, setPedidos] = useState(cargarPedidos);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevosItems, setNuevosItems] = useState('');
  const [nuevoTotal, setNuevoTotal] = useState('');
  const reconocimientoRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('chefnote_pedidos', JSON.stringify(pedidos));
    } catch {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando */
    }
  }, [pedidos]);

  // Detener el micrófono si el componente se desmonta
  useEffect(() => () => reconocimientoRef.current?.stop(), []);

  const alternarMicrofono = () => {
    // Si ya está escuchando, detiene la misma instancia
    if (escuchando) {
      reconocimientoRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta el dictado por voz. Puedes ingresar el pedido manualmente abajo.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-DO';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const texto = event.results[0][0].transcript;
      const { monto, cliente } = analizarDictado(texto);
      setTranscripcion(texto);
      setNuevosItems(texto);
      if (monto) setNuevoTotal(monto);
      setNuevoCliente(cliente || 'Cliente Dictado');
    };
    recognition.onerror = () => setEscuchando(false);
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

  const agregarPedido = (e) => {
    e.preventDefault();
    if (!nuevosItems.trim()) return;

    const nuevo = {
      id: Date.now(),
      cliente: nuevoCliente.trim() || 'Cliente General',
      items: nuevosItems.trim(),
      total: Number(nuevoTotal) || 0,
      estado: 'pendiente',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setPedidos((prev) => [nuevo, ...prev]);
    setNuevoCliente('');
    setNuevosItems('');
    setNuevoTotal('');
    setTranscripcion('');
  };

  const cambiarEstado = (id) =>
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estado: p.estado === 'pendiente' ? 'listo' : 'pendiente' } : p))
    );

  const eliminarPedido = (id) => setPedidos((prev) => prev.filter((p) => p.id !== id));

  const totalVentas = pedidos.filter((p) => p.estado === 'listo').reduce((acc, p) => acc + p.total, 0);
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length;

  return (
    <div className="mx-auto max-w-xl p-4">
      {/* Encabezado */}
      <header className="mb-5 flex items-center justify-between border-b border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <ChefHat size={32} className="text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-50">ChefNote Express</h1>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
          <span className="block text-xs text-slate-400">Ventas hoy</span>
          <span className="text-lg font-bold text-green-500">{formatoMonto(totalVentas)}</span>
        </div>
      </header>

      {/* Botón de dictado */}
      <section className="mb-6">
        <button
          type="button"
          onClick={alternarMicrofono}
          aria-pressed={escuchando}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl p-6 text-xl font-bold text-white shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 ${
            escuchando ? 'animate-pulse bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-500'
          }`}
        >
          {escuchando ? <MicOff size={40} /> : <Mic size={40} />}
          <span>{escuchando ? 'Escuchando pedido... (toca para detener)' : 'Toca para dictar pedido'}</span>
        </button>
        {transcripcion && (
          <p className="mt-2 text-center text-sm italic text-slate-300">“{transcripcion}”</p>
        )}
      </section>

      {/* Formulario manual */}
      <form onSubmit={agregarPedido} className="mb-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-200">Anotación rápida</h2>
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Cliente (ej: Juan)"
            value={nuevoCliente}
            onChange={(e) => setNuevoCliente(e.target.value)}
            className={campo}
          />
          <input
            type="text"
            placeholder="Pedido (ej: 2 Pizzas, 1 Refresco)"
            value={nuevosItems}
            onChange={(e) => setNuevosItems(e.target.value)}
            required
            className={campo}
          />
          <div className="flex gap-2.5">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Monto ($)"
              value={nuevoTotal}
              onChange={(e) => setNuevoTotal(e.target.value)}
              className={`${campo} flex-1`}
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-green-500 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-300"
            >
              <Plus size={20} /> Guardar
            </button>
          </div>
        </div>
      </form>

      {/* Lista de pedidos */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-50">
          <ShoppingBag size={20} /> Pedidos activos ({pendientes})
        </h2>

        {pedidos.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            No hay pedidos. Dicta uno o anótalo arriba.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {pedidos.map((pedido) => {
            const listo = pedido.estado === 'listo';
            return (
              <div
                key={pedido.id}
                className={`flex items-center justify-between rounded-xl border-l-[6px] p-4 ${
                  listo ? 'border-green-500 bg-slate-900 opacity-60' : 'border-orange-500 bg-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-slate-50">{pedido.cliente}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} /> {pedido.hora}
                    </span>
                  </div>
                  <p className="my-1 break-words text-base text-slate-300">{pedido.items}</p>
                  <span className="text-base font-bold text-orange-500">{formatoMonto(pedido.total)}</span>
                </div>

                <div className="ml-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => cambiarEstado(pedido.id)}
                    title={listo ? 'Volver a pendiente' : 'Marcar como listo'}
                    aria-label={listo ? 'Volver a pendiente' : 'Marcar como listo'}
                    className={`rounded-lg p-3 text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-300 ${
                      listo ? 'bg-slate-600 hover:bg-slate-500' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    <Check size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarPedido(pedido.id)}
                    title="Eliminar pedido"
                    aria-label="Eliminar pedido"
                    className="rounded-lg bg-red-500 p-3 text-white transition-colors hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
