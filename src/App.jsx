import { useState, useEffect, useRef } from 'react';
import {
  Mic, Check, Plus, Pencil, Trash2, X, Save, Undo2, Archive, ChefHat, CalendarClock,
  MessageCircle, History, ChevronLeft, ChevronRight, StickyNote, Download, Upload,
} from 'lucide-react';

// Nombre del negocio para firmar los mensajes de WhatsApp (déjalo vacío para no incluirlo)
const NEGOCIO = '';

/* ---------- Utilidades ---------- */
const pad = (n) => String(n).padStart(2, '0');
const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const sumarDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return aISO(d);
};
const horaValida = (h) => /^\d{2}:\d{2}$/.test(h || '');
const leer = (clave) => {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : [];
  } catch {
    return [];
  }
};
const guardar = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando */
  }
};

const formatoNumero = new Intl.NumberFormat('es-AR', { useGrouping: 'always', maximumFractionDigits: 2 });
const formatoMonto = (n) => `AR$ ${formatoNumero.format(Number(n || 0))}`;
const verMonto = (v) => (v ? formatoNumero.format(Number(v)) : '');
const lineas = (texto) => texto.split(/\s*,\s*/).filter(Boolean);
const limpiarMonto = (v) => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const etiquetaDia = (iso) => {
  if (iso === sumarDias(0)) return 'Hoy';
  if (iso === sumarDias(1)) return 'Mañana';
  return deISO(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
};
const aHora24 = (txt) => {
  const m = txt.trim().match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return '';
  return `${pad(h)}:${pad(min)}`;
};
const formatoHora = (h24) => `${h24} hs`;

const cobradoDe = (p) => (p.pago === 'pagado' ? p.total : p.pago === 'abono' ? p.abono || 0 : 0);
const debeDe = (p) => Math.max(p.total - cobradoDe(p), 0);
const estaAtrasado = (p) => {
  if (p.estado === 'listo' || !p.fecha) return false;
  const limite = p.hora ? new Date(`${p.fecha}T${p.hora}`) : new Date(deISO(p.fecha).getTime() + 86399000);
  return limite < new Date();
};
// Celulares de Argentina: 54 + 9 + código de área + número (sin 0 ni 15)
const numeroWhatsApp = (tel) => {
  let d = tel.replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  d = d.replace(/^0/, '');
  if (d.length === 12) {
    for (const n of [2, 3, 4]) {
      if (d.slice(n, n + 2) === '15') {
        d = d.slice(0, n) + d.slice(n + 2);
        break;
      }
    }
  }
  return d.length === 10 ? `549${d}` : d;
};
const enlaceWhatsApp = (p) => {
  const numero = numeroWhatsApp(p.telefono);
  const listo = p.estado === 'listo';
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  const cobrado = cobradoDe(p);
  const debe = debeDe(p);

  const pago =
    p.pago === 'pagado'
      ? '*Estado del pago:* abonado en su totalidad'
      : p.pago === 'abono'
        ? `*Abonado:* ${formatoMonto(cobrado)}\n*Saldo pendiente:* ${formatoMonto(debe)}`
        : `*Saldo a abonar:* ${formatoMonto(debe)}`;

  const partes = [
    `${saludo}, ${p.cliente}.`,
    `Le escribimos${NEGOCIO ? ` de ${NEGOCIO}` : ''} ${listo ? 'para informarle que su pedido ya está listo.' : 'para confirmar su pedido.'}`,
    `*Detalle del pedido*\n${lineas(p.items).map((l) => `• ${l}`).join('\n')}`,
    `*Total:* ${formatoMonto(p.total)}\n${pago}`,
    p.fecha ? `*Entrega:* ${etiquetaDia(p.fecha)}${p.hora ? ` · ${formatoHora(p.hora)}` : ''}` : null,
    listo
      ? 'Quedamos a su disposición para coordinar la entrega. Muchas gracias por su confianza.'
      : 'Quedamos atentos a cualquier consulta. Muchas gracias por su confianza.',
    `Saludos cordiales${NEGOCIO ? `,\n${NEGOCIO}` : '.'}`,
  ].filter(Boolean);

  return `https://wa.me/${numero}?text=${encodeURIComponent(partes.join('\n\n'))}`;
};

// Extrae monto y cliente del texto dictado
const analizarDictado = (texto) => {
  const matchMonto = texto.match(/(\d[\d.,]*)\s*(?:pesos|peso|\$)/i) || texto.match(/\$\s*(\d[\d.,]*)/);
  const n = matchMonto ? Number(matchMonto[1].replace(/\./g, '').replace(',', '.')) : NaN;
  const monto = Number.isFinite(n) ? String(Math.round(n)) : '';
  const matchCliente = texto.match(/\bpara\s+([^,.\d]+?)(?=\s+(?:con|de|y|por)\b|[,.\d]|$)/i);
  return { monto, cliente: matchCliente ? matchCliente[1].trim() : '' };
};

const vacio = () => ({
  cliente: '', telefono: '', items: '', monto: '', fecha: sumarDias(0),
  hora: '', pago: 'sin', abono: '', notas: '',
});

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'pendiente', etiqueta: 'Pendientes' },
  { id: 'listo', etiqueta: 'Listos' },
];
const PAGOS = [
  { id: 'sin', etiqueta: 'Sin pagar' },
  { id: 'abono', etiqueta: 'Abono' },
  { id: 'pagado', etiqueta: 'Pagado' },
];

const campo =
  'w-full rounded-xl border border-borde bg-tinta/60 px-4 py-3 text-base text-harina placeholder:text-niebla/60 transition-colors focus:border-mantequilla focus:outline-none';
const etiquetaCampo = 'mb-1.5 block text-sm text-niebla';
const boton = 'grid size-11 shrink-0 place-items-center rounded-xl border transition-colors';
const chip = (activo) =>
  `rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
    activo ? 'border-mantequilla bg-mantequilla text-tinta' : 'border-borde text-niebla hover:bg-white/5 hover:text-harina'
  }`;

/* ---------- Calendario propio ---------- */
function Calendario({ valor, onElegir }) {
  const base = valor ? deISO(valor) : new Date();
  const [mes, setMes] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const hoy = sumarDias(0);
  const vacios = (mes.getDay() + 6) % 7;
  const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = [...Array(vacios).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const mover = (n) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));

  return (
    <div className="aparecer mt-3 rounded-xl border border-borde bg-tinta/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="grid size-9 place-items-center rounded-lg hover:bg-white/5">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold capitalize">{mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="grid size-9 place-items-center rounded-lg hover:bg-white/5">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-niebla">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="py-1">{d}</span>)}
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`v${i}`} />;
          const iso = aISO(new Date(mes.getFullYear(), mes.getMonth(), dia));
          const activo = iso === valor;
          return (
            <button
              key={iso}
              type="button"
              disabled={iso < hoy}
              onClick={() => onElegir(iso)}
              className={`grid h-9 place-items-center rounded-lg text-sm tabular-nums transition-colors disabled:opacity-30 ${
                activo ? 'bg-mantequilla font-bold text-tinta' : iso === hoy ? 'border border-mantequilla/50 text-harina' : 'text-harina hover:bg-white/5'
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [pedidos, setPedidos] = useState(() => leer('chefnote_pedidos').map((p) => (horaValida(p.hora) ? p : { ...p, hora: '' })));
  const [historial, setHistorial] = useState(() => leer('chefnote_historial').map((p) => (horaValida(p.hora) ? p : { ...p, hora: '' })));
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [form, setForm] = useState(vacio);
  const [calAbierto, setCalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [aviso, setAviso] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [ultimaCopia, setUltimaCopia] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chefnote_ultima_copia')) || '';
    } catch {
      return '';
    }
  });
  const reconocimientoRef = useRef(null);
  const formularioRef = useRef(null);
  const avisoTimer = useRef(null);
  const archivoRef = useRef(null);

  const poner = (clave, valor) => setForm((f) => ({ ...f, [clave]: valor }));

  useEffect(() => guardar('chefnote_pedidos', pedidos), [pedidos]);
  useEffect(() => guardar('chefnote_historial', historial), [historial]);
  useEffect(() => () => {
    reconocimientoRef.current?.stop();
    clearTimeout(avisoTimer.current);
  }, []);
  useEffect(() => {
    if (!confirmacion && !verHistorial) return;
    const alTeclear = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmacion) setConfirmacion(null);
      else setVerHistorial(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [confirmacion, verHistorial]);

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
    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const texto = event.results[0][0].transcript;
      const dato = analizarDictado(texto);
      setTranscripcion(texto);

      // Cada dato del dictado va a su campo. Si algo no se detecta,
      // se conserva lo que ya estaba escrito en ese campo.
      setForm((f) => ({
        ...f,
        cliente: dato.cliente || f.cliente,
        telefono: dato.telefono || f.telefono,
        items: dato.items || f.items,
        monto: dato.monto || f.monto,
        fecha: dato.fecha || f.fecha,
        hora: dato.hora || f.hora,
        pago: dato.pago || f.pago,
        notas: dato.notas || f.notas,
      }));
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
    setForm(vacio());
    setTranscripcion('');
    setCalAbierto(false);
    setEditandoId(null);
  };

  const guardarPedido = (e) => {
    e.preventDefault();
    if (!form.items.trim()) return;
    const total = Number(form.monto) || 0;
    let hora = '';
    if (form.hora.trim()) {
      hora = aHora24(form.hora);
      if (!hora) {
        avisar('Revisa la hora de entrega, por ejemplo 15:30');
        return;
      }
    }
    let pago = form.pago;
    const abono = Number(form.abono) || 0;
    if (pago === 'abono') {
      if (abono <= 0) {
        avisar('Escribe cuánto abonó el cliente');
        return;
      }
      if (total > 0 && abono >= total) pago = 'pagado';
    }
    const datos = {
      cliente: form.cliente.trim() || 'Cliente general',
      telefono: form.telefono,
      items: form.items.trim(),
      total,
      fecha: form.fecha,
      hora,
      pago,
      abono: pago === 'abono' ? abono : 0,
      notas: form.notas.trim(),
    };
    if (editandoId) {
      setPedidos((prev) => prev.map((p) => (p.id === editandoId ? { ...p, ...datos } : p)));
      avisar('Pedido actualizado');
    } else {
      setPedidos((prev) => [{ id: Date.now(), ...datos, estado: 'pendiente' }, ...prev]);
      setFiltro((f) => (f === 'listo' ? 'todos' : f));
      avisar('Pedido guardado');
    }
    limpiarFormulario();
  };

  const empezarEdicion = (p) => {
    setEditandoId(p.id);
    setForm({
      cliente: p.cliente, telefono: p.telefono || '', items: p.items, monto: String(p.total),
      fecha: p.fecha || sumarDias(0), hora: p.hora || '', pago: p.pago || 'sin',
      abono: p.abono ? String(p.abono) : '', notas: p.notas || '',
    });
    setTranscripcion('');
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cambiarEstado = (id) =>
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: p.estado === 'pendiente' ? 'listo' : 'pendiente' } : p)));

  const marcarPagado = (p) => {
    const antes = { pago: p.pago || 'sin', abono: p.abono || 0 };
    setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, pago: 'pagado', abono: 0 } : x)));
    avisar('Marcado como pagado', {
      etiqueta: 'Deshacer',
      fn: () => {
        setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...antes } : x)));
        setAviso(null);
      },
    });
  };

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
    const listos = pedidos.filter((p) => p.estado === 'listo');
    if (!listos.length) {
      avisar('Todavía no hay pedidos listos para cerrar');
      return;
    }
    const sinCobrar = listos.reduce((a, p) => a + debeDe(p), 0);
    setConfirmacion({
      titulo: 'Cerrar el día',
      etiqueta: 'Cerrar el día',
      texto: `Se guardarán ${listos.length} pedido${listos.length > 1 ? 's' : ''} listo${listos.length > 1 ? 's' : ''} en el historial.${
        sinCobrar ? ` Ojo: quedan ${formatoMonto(sinCobrar)} sin cobrar en esos pedidos.` : ''
      } Los pendientes se quedan.`,
      accion: () => {
        const hoy = sumarDias(0);
        setHistorial((h) => [...listos.map((p) => ({ ...p, cerrado: hoy })), ...h]);
        if (listos.some((p) => p.id === editandoId)) limpiarFormulario();
        setPedidos((prev) => prev.filter((p) => p.estado !== 'listo'));
        setConfirmacion(null);
        avisar('Día cerrado');
      },
    });
  };

  const pedirVaciarHistorial = () =>
    setConfirmacion({
      titulo: 'Vaciar historial',
      etiqueta: 'Vaciar',
      texto: 'Se borrarán todos los días guardados. Esto no se puede deshacer.',
      accion: () => {
        setHistorial([]);
        setConfirmacion(null);
        avisar('Historial vaciado');
      },
    });

  const descargarCopia = () => {
    const hoy = sumarDias(0);
    const datos = { app: 'chefnote-express', version: 1, fecha: new Date().toISOString(), pedidos, historial };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `chefnote-copia-${hoy}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    guardar('chefnote_ultima_copia', hoy);
    setUltimaCopia(hoy);
    avisar('Copia descargada');
  };

  const elegirCopia = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(lector.result);
        if (!Array.isArray(datos.pedidos) || !Array.isArray(datos.historial)) throw new Error('formato');
        const limpiar = (lista) => lista.map((p) => (horaValida(p.hora) ? p : { ...p, hora: '' }));
        setConfirmacion({
          titulo: 'Restaurar copia',
          etiqueta: 'Restaurar',
          texto: `Se reemplazarán los datos actuales por los de la copia: ${datos.pedidos.length} pedido${datos.pedidos.length === 1 ? '' : 's'} y ${datos.historial.length} en el historial.`,
          accion: () => {
            setPedidos(limpiar(datos.pedidos));
            setHistorial(limpiar(datos.historial));
            limpiarFormulario();
            setConfirmacion(null);
            avisar('Copia restaurada');
          },
        });
      } catch {
        avisar('Ese archivo no es una copia válida de ChefNote');
      }
    };
    lector.readAsText(archivo);
  };

  const cobrado = pedidos.reduce((a, p) => a + cobradoDe(p), 0);
  const porCobrar = pedidos.reduce((a, p) => a + debeDe(p), 0);
  const cuenta = {
    todos: pedidos.length,
    pendiente: pedidos.filter((p) => p.estado === 'pendiente').length,
    listo: pedidos.filter((p) => p.estado === 'listo').length,
  };
  const clave = (p) => `${p.fecha || '9999-99-99'}T${p.hora || '23:59'}`;
  const visibles = (filtro === 'todos' ? pedidos : pedidos.filter((p) => p.estado === filtro)).sort((a, b) =>
    a.estado === b.estado ? clave(a).localeCompare(clave(b)) : a.estado === 'listo' ? 1 : -1
  );
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const chipsDias = Array.from({ length: 6 }, (_, i) => sumarDias(i));
  if (form.fecha && !chipsDias.includes(form.fecha)) chipsDias.push(form.fecha);
  const grupos = Object.entries(
    historial.reduce((acc, p) => {
      (acc[p.cerrado] ||= []).push(p);
      return acc;
    }, {})
  ).sort((a, b) => b[0].localeCompare(a[0]));

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
          <p className="text-xs text-niebla">Cobrado</p>
          <p className="text-2xl font-bold tabular-nums text-mantequilla">{formatoMonto(cobrado)}</p>
          {porCobrar > 0 && <p className="text-xs tabular-nums text-niebla">Por cobrar {formatoMonto(porCobrar)}</p>}
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
        className={`mb-10 rounded-2xl border bg-panel p-5 transition-colors ${editandoId ? 'border-mantequilla' : 'border-borde'}`}
      >
        <h2 className="mb-4 text-lg font-semibold">{editandoId ? 'Editar pedido' : 'Nuevo pedido'}</h2>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={etiquetaCampo}>Cliente</span>
              <input type="text" value={form.cliente} onChange={(e) => poner('cliente', e.target.value)} placeholder="Ana" className={campo} />
            </label>
            <label className="block">
              <span className={etiquetaCampo}>Teléfono (para WhatsApp)</span>
              <input
                type="text"
                inputMode="tel"
                value={form.telefono}
                onChange={(e) => poner('telefono', e.target.value.replace(/[^\d+\s-]/g, ''))}
                placeholder="11 5555 1234"
                className={campo}
              />
            </label>
          </div>

          <label className="block">
            <span className={etiquetaCampo}>Pedido</span>
            <input
              type="text"
              value={form.items}
              onChange={(e) => poner('items', e.target.value)}
              required
              placeholder="2 brownies, 1 pie de limón"
              className={campo}
            />
          </label>

          <div>
            <span className={etiquetaCampo}>Entrega</span>
            <div className="flex flex-wrap gap-2">
              {chipsDias.map((iso) => (
                <button key={iso} type="button" onClick={() => { poner('fecha', iso); setCalAbierto(false); }} className={chip(form.fecha === iso)}>
                  {etiquetaDia(iso)}
                </button>
              ))}
              <button type="button" onClick={() => setCalAbierto((v) => !v)} className={chip(calAbierto)}>
                Otro día
              </button>
            </div>
            {calAbierto && <Calendario valor={form.fecha} onElegir={(iso) => { poner('fecha', iso); setCalAbierto(false); }} />}
            <div className="mt-3 flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={form.hora}
                onChange={(e) => poner('hora', e.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
                placeholder="15:30"
                aria-label="Hora de entrega"
                className={`${campo.replace('w-full', 'w-28 shrink-0')} tabular-nums`}
              />
              <span className="whitespace-nowrap text-sm text-niebla">Hora opcional (24 h)</span>
            </div>
          </div>

          <div>
            <span className={etiquetaCampo}>Monto y pago</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative block w-44">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-niebla">AR$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={verMonto(form.monto)}
                  onChange={(e) => poner('monto', limpiarMonto(e.target.value))}
                  placeholder="0"
                  aria-label="Monto total"
                  className={`${campo} pl-14 tabular-nums`}
                />
              </span>
              <div className="flex gap-2">
                {PAGOS.map((o) => (
                  <button key={o.id} type="button" onClick={() => poner('pago', o.id)} className={chip(form.pago === o.id)}>
                    {o.etiqueta}
                  </button>
                ))}
              </div>
            </div>
            {form.pago === 'abono' && (
              <span className="relative mt-3 block w-52">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-niebla">AR$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={verMonto(form.abono)}
                  onChange={(e) => poner('abono', limpiarMonto(e.target.value))}
                  placeholder="Cuánto abonó"
                  aria-label="Monto del abono"
                  className={`${campo} pl-14 tabular-nums`}
                />
              </span>
            )}
          </div>

          <label className="block">
            <span className={etiquetaCampo}>Notas</span>
            <input
              type="text"
              value={form.notas}
              onChange={(e) => poner('notas', e.target.value)}
              placeholder="Sin nueces, mensaje en la torta…"
              className={campo}
            />
          </label>

          <div className="flex justify-end gap-3">
            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="flex h-12 items-center gap-1.5 rounded-xl border border-borde px-4 font-semibold transition-colors hover:bg-white/5"
              >
                <X size={18} /> Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex h-12 items-center gap-1.5 rounded-xl bg-mantequilla px-6 font-bold text-tinta transition-colors hover:bg-[#f6cf72]"
            >
              {editandoId ? <Save size={18} /> : <Plus size={18} />} {editandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>

      {/* Comandas */}
      <section aria-label="Pedidos">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pedidos</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVerHistorial(true)}
              className="flex items-center gap-1.5 rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-niebla transition-colors hover:bg-white/5 hover:text-harina"
            >
              <History size={16} /> Historial
            </button>
            <button
              type="button"
              onClick={pedirCierre}
              className="flex items-center gap-1.5 rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-niebla transition-colors hover:bg-white/5 hover:text-harina"
            >
              <Archive size={16} /> Cerrar el día
            </button>
          </div>
        </div>

        <div className="mb-4 flex w-fit max-w-full overflow-x-auto rounded-xl bg-panel p-1" role="tablist" aria-label="Filtrar pedidos">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                filtro === f.id ? 'bg-harina text-tinta' : 'text-niebla hover:text-harina'
              }`}
            >
              {f.etiqueta} <span className="tabular-nums opacity-60">{cuenta[f.id]}</span>
            </button>
          ))}
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
            const atrasado = estaAtrasado(p);
            const debe = debeDe(p);
            const pagado = p.pago === 'pagado';
            const btnSuave = listo ? 'border-borde text-niebla hover:bg-white/5' : 'border-tinta/20 text-tinta hover:bg-tinta/5';
            return (
              <li
                key={p.id}
                className={`relative rounded-2xl ${listo ? 'bg-panel text-niebla' : 'bg-harina text-tinta'} ${
                  p.id === editandoId ? 'ring-2 ring-mantequilla ring-offset-2 ring-offset-tinta' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <h3 className={`text-lg font-bold leading-tight ${listo ? 'text-harina' : ''}`}>{p.cliente}</h3>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 pt-0.5 text-sm font-semibold tabular-nums ${
                      atrasado ? 'text-[#c2263f]' : 'opacity-70'
                    }`}
                  >
                    <CalendarClock size={14} />
                    {p.fecha ? etiquetaDia(p.fecha) : 'Sin fecha'}
                    {p.hora ? ` · ${formatoHora(p.hora)}` : ''}
                    {atrasado ? ' · Atrasado' : ''}
                  </span>
                </div>

                <div className="relative">
                  <div className={`border-t border-dashed ${listo ? 'border-borde' : 'border-tinta/25'}`} />
                  <span className="absolute -left-2 -top-2 size-4 rounded-full bg-tinta" />
                  <span className="absolute -right-2 -top-2 size-4 rounded-full bg-tinta" />
                </div>

                <ul className="space-y-1 px-4 pb-3 pt-3.5">
                  {lineas(p.items).map((linea, i) => (
                    <li key={i} className={`text-base ${listo ? 'line-through decoration-niebla/40' : ''}`}>{linea}</li>
                  ))}
                </ul>

                {p.notas && (
                  <p className={`mx-4 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${listo ? 'bg-white/5' : 'bg-mantequilla/30'}`}>
                    <StickyNote size={15} className="mt-0.5 shrink-0" /> {p.notas}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 px-4 pb-4">
                  <div className="min-w-0">
                    <span className={`block text-xl font-extrabold tabular-nums ${listo ? 'text-harina' : ''}`}>{formatoMonto(p.total)}</span>
                    {pagado ? (
                      <span className={`mt-1 inline-flex items-center gap-1 text-sm font-semibold ${listo ? 'text-pistacho' : 'text-[#2f7a55]'}`}>
                        <Check size={14} strokeWidth={3} /> Pagado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcarPagado(p)}
                        title="Marcar como pagado"
                        className={`mt-1 rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors ${
                          listo ? 'border-frambuesa/40 text-frambuesa hover:bg-frambuesa/10' : 'border-[#c2263f]/40 text-[#c2263f] hover:bg-[#c2263f]/10'
                        }`}
                      >
                        {p.pago === 'abono' ? `Debe ${formatoMonto(debe)}` : 'Sin pagar'} · Cobrar
                      </button>
                    )}
                  </div>
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
                    {p.telefono && (
                      <a
                        href={enlaceWhatsApp(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar mensaje por WhatsApp"
                        aria-label="Enviar mensaje por WhatsApp"
                        className={`${boton} ${btnSuave}`}
                      >
                        <MessageCircle size={18} />
                      </a>
                    )}
                    <button type="button" onClick={() => empezarEdicion(p)} title="Editar pedido" aria-label="Editar pedido" className={`${boton} ${btnSuave}`}>
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

      {/* Historial */}
      {verHistorial && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-tinta" role="dialog" aria-modal="true" aria-label="Historial">
          <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight">Historial</h2>
              <div className="flex gap-2">
                {historial.length > 0 && (
                  <button
                    type="button"
                    onClick={pedirVaciarHistorial}
                    className="rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-niebla transition-colors hover:bg-white/5 hover:text-frambuesa"
                  >
                    Vaciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVerHistorial(false)}
                  aria-label="Cerrar historial"
                  className="grid size-11 place-items-center rounded-xl border border-borde transition-colors hover:bg-white/5"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="mb-6 rounded-2xl border border-borde bg-panel p-4">
              <h3 className="font-bold">Copia de seguridad</h3>
              <p className="mt-1 text-sm text-niebla">
                Guarda los pedidos y el historial en un archivo, por si se cambia de celular o se borran los datos del navegador.{' '}
                {ultimaCopia
                  ? `Última copia: ${deISO(ultimaCopia).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}.`
                  : 'Todavía no hay ninguna copia.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={descargarCopia}
                  className="flex items-center gap-1.5 rounded-xl bg-mantequilla px-4 py-2.5 text-sm font-bold text-tinta transition-colors hover:bg-[#f6cf72]"
                >
                  <Download size={16} /> Descargar copia
                </button>
                <button
                  type="button"
                  onClick={() => archivoRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-borde px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
                >
                  <Upload size={16} /> Restaurar copia
                </button>
                <input ref={archivoRef} type="file" accept="application/json,.json" onChange={elegirCopia} className="hidden" />
              </div>
            </div>
            {grupos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-borde px-6 py-12 text-center text-niebla">
                Aquí aparecerán los días que cierres.
              </p>
            )}
            <div className="flex flex-col gap-5">
              {grupos.map(([dia, lista]) => (
                <section key={dia} className="rounded-2xl border border-borde bg-panel p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-bold first-letter:uppercase">
                      {deISO(dia).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <span className="text-sm tabular-nums text-niebla">
                      {lista.length} pedido{lista.length > 1 ? 's' : ''} ·{' '}
                      <span className="font-bold text-mantequilla">{formatoMonto(lista.reduce((a, p) => a + cobradoDe(p), 0))}</span> cobrado
                    </span>
                  </div>
                  <ul className="divide-y divide-borde">
                    {lista.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-semibold">{p.cliente}</p>
                          <p className="break-words text-sm text-niebla">{p.items}</p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="font-semibold">{formatoMonto(p.total)}</p>
                          {debeDe(p) > 0 && <p className="text-xs text-frambuesa">Debe {formatoMonto(debeDe(p))}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Aviso */}
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className="aparecer fixed inset-x-4 bottom-5 z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-borde bg-panel px-4 py-3 text-sm shadow-xl shadow-black/40"
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/80 p-4 backdrop-blur-sm" onClick={() => setConfirmacion(null)}>
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
                {confirmacion.etiqueta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
