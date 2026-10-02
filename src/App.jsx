import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Plus, Check, Clock, Trash2, ShoppingBag, DollarSign, ChefHat } from 'lucide-react';

export default function App() {
  const [pedidos, setPedidos] = useState(() => {
    const saved = localStorage.getItem('chefnote_pedidos');
    return saved ? JSON.parse(saved) : [
      { id: 1, cliente: "María López", items: "2 Brownies de Chocolate, 1 Pie de Limón", total: 850, estado: "pendiente", hora: "12:30 PM" },
      { id: 2, cliente: "Carlos Gomez", items: "1 Torta Red Velvet Grande", total: 1200, estado: "listo", hora: "01:15 PM" }
    ];
  });

  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevosItems, setNuevosItems] = useState('');
  const [nuevoTotal, setNuevoTotal] = useState('');

  useEffect(() => {
    localStorage.setItem('chefnote_pedidos', JSON.stringify(pedidos));
  }, [pedidos]);

  // Manejo de reconocimiento de voz
  const alternarMicrofono = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta el dictado por voz. Puedes ingresar el pedido manualmente abajo.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!escuchando) {
      setEscuchando(true);
      recognition.start();

      recognition.onresult = (event) => {
        const texto = event.results[0][0].transcript;
        setTranscripcion(texto);
        parsearDictado(texto);
        setEscuchando(false);
      };

      recognition.onerror = () => {
        setEscuchando(false);
      };

      recognition.onend = () => {
        setEscuchando(false);
      };
    } else {
      setEscuchando(false);
      recognition.stop();
    }
  };

  // Parser simple para extraer datos del dictado
  const parsearDictado = (texto) => {
    // Busca números al final o cerca de "pesos" / "monto"
    const regexMonto = /(\d+)\s*(pesos|pesos\s*domicanos|\$)?/i;
    const matchMonto = texto.match(regexMonto);

    if (matchMonto) {
      setNuevoTotal(matchMonto[1]);
    }

    // Asigna el texto completo a la lista de items para edición rápida
    setNuevosItems(texto);
    setNuevoCliente('Cliente Dictado');
  };

  const agregarPedido = (e) => {
    e.preventDefault();
    if (!nuevosItems) return;

    const nuevo = {
      id: Date.now(),
      cliente: nuevoCliente || 'Cliente General',
      items: nuevosItems,
      total: Number(nuevoTotal) || 0,
      estado: 'pendiente',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setPedidos([nuevo, ...pedidos]);
    setNuevoCliente('');
    setNuevosItems('');
    setNuevoTotal('');
    setTranscripcion('');
  };

  const cambiarEstado = (id) => {
    setPedidos(pedidos.map(p => {
      if (p.id === id) {
        return { ...p, estado: p.estado === 'pendiente' ? 'listo' : 'pendiente' };
      }
      return p;
    }));
  };

  const eliminarPedido = (id) => {
    setPedidos(pedidos.filter(p => p.id !== id));
  };

  const totalVentas = pedidos
    .filter(p => p.estado === 'listo')
    .reduce((acc, p) => acc + p.total, 0);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      {/* Encabezado */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChefHat size={32} color="#f97316" />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>ChefNote Express</h1>
        </div>
        <div style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Ventas Hoy</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>${totalVentas}</span>
        </div>
      </header>

      {/* Botón de Dictado Gigante para Cocina */}
      <section style={{ marginBottom: '24px' }}>
        <button
          onClick={alternarMicrofono}
          style={{
            width: '100%',
            padding: '24px',
            borderRadius: '16px',
            border: 'none',
            background: escuchando ? '#dc2626' : '#ea580c',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
          }}
        >
          {escuchando ? <MicOff size={40} /> : <Mic size={40} />}
          <span>{escuchando ? 'Escuchando pedido... (Toca para detener)' : '🎙️ TOCA PARA DICTAR PEDIDO'}</span>
        </button>
        {transcripcion && (
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#cbd5e1', fontStyle: 'italic', textAlign: 'center' }}>
            "{transcripcion}"
          </p>
        )}
      </section>

      {/* Formulario Manual Express */}
      <form onSubmit={agregarPedido} style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #334155' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>Anotación Rápida</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Cliente (ej: Juan)"
            value={nuevoCliente}
            onChange={(e) => setNuevoCliente(e.target.value)}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px' }}
          />
          <input
            type="text"
            placeholder="Pedido (ej: 2 Pizzas, 1 Refresco)"
            value={nuevosItems}
            onChange={(e) => setNuevosItems(e.target.value)}
            required
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px' }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              placeholder="Monto ($)"
              value={nuevoTotal}
              onChange={(e) => setNuevoTotal(e.target.value)}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px' }}
            />
            <button
              type="submit"
              style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={20} /> Guardar
            </button>
          </div>
        </div>
      </form>

      {/* Lista de Pedidos en la Cocina */}
      <section>
        <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingBag size={20} /> Pedidos Activos ({pedidos.filter(p => p.estado === 'pendiente').length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              style={{
                background: pedido.estado === 'listo' ? '#0f172a' : '#1e293b',
                padding: '16px',
                borderRadius: '12px',
                borderLeft: `6px solid ${pedido.estado === 'listo' ? '#22c55e' : '#f97316'}`,
                opacity: pedido.estado === 'listo' ? 0.6 : 1,
                display: 'flex',
                justifySpace: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '18px' }}>{pedido.cliente}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={12} /> {pedido.hora}
                  </span>
                </div>
                <p style={{ margin: '4px 0', color: '#cbd5e1', fontSize: '16px' }}>{pedido.items}</p>
                <span style={{ fontWeight: 'bold', color: '#f97316', fontSize: '16px' }}>${pedido.total}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                <button
                  onClick={() => cambiarEstado(pedido.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: pedido.estado === 'listo' ? '#475569' : '#22c55e',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  title="Marcar como listo"
                >
                  <Check size={24} />
                </button>
                <button
                  onClick={() => eliminarPedido(pedido.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  title="Eliminar"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}