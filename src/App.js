import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Circle,
  Plus,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
  User,
  Phone,
  Send,
  Minus,
  History,
  CalendarDays,
  Download
} from "lucide-react";

// === Utilidades ===
const currency = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const todayKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10); // YYYY-MM-DD local
};

const STORAGE_KEY = "fastfood_orders_v2"; // v2: múltiples productos por pedido
const loadOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};
const saveOrders = (data) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

// Productos de ejemplo — reemplace las imágenes por las suyas
const DEFAULT_PRODUCTS = [
  { id: "perro_sencillo", name: "Perro Sencillo", price: 6000, image: "/img/perro_sencillo.jpg" },
  { id: "choriperro", name: "Choriperro", price: 9000, image: "/img/choriperro.jpg" },
  { id: "perro_suizo", name: "Perro Suizo", price: 10000, image: "/img/perro_suizo.jpg" },
  { id: "perro_mixto_S&S", name: "Perro Mixto S&S", price: 11000, image: "/img/perro_mixto_ss.jpg" },
  { id: "tocisuizo", name: "Tocisuizo", price: 12000, image: "/img/tocisuizo2.jpg" },
  { id: "italo_suizo", name: "Italo Suizo", price: 12000, image: "/img/italo_suizo.jpg" },
  { id: "S&S_burguer", name: "S&S Burguer", price: 13000, image: "/img/s_s_burguer.jpg" },
  { id: "S&S_maxi_burguer", name: "S&S Maxi Burguer", price: 16000, image: "/img/s_s_maxi_burguer.jpg" },
  { id: "gaseosa", name: "Gaseosa", price: 3000, image: "/img/gaseosa2.png" },
  { id: "combo_sencillo", name: "Combo Sencillo", price: 9000, image: "/img/combo_sencillo.jpg" },
  { id: "combo_tocisuizo", name: "Combo Tocisuizo", price: 15000, image: "/img/combo_tocisuizo.jpg" },
  { id: "combo_S&S_burguer", name: "Combo S&S Burguer", price: 16000, image: "/img/combo_s_s_burguer.png" },
];

// Calcula total de una orden (compatible con esquema antiguo y nuevo)
const orderTotal = (o) => {
  if (o.items) return o.items.reduce((acc, it) => acc + it.product.price * it.qty, 0);
  return (o?.product?.price || 0) * (o?.qty || 0);
};

const kitchenStyles = {
  pending: "bg-gray-50 border-gray-300 text-gray-700",
  preparing: "bg-blue-50 border-blue-300 text-blue-700",
  ready: "bg-emerald-50 border-emerald-300 text-emerald-700",
};


export default function App() {
  const [products] = useState(DEFAULT_PRODUCTS);
  const [ordersByDay, setOrdersByDay] = useState(loadOrders());
  const [showNew, setShowNew] = useState(false);

  // HISTORIAL
  const [showHistory, setShowHistory] = useState(false);
  const [histStatus, setHistStatus] = useState("all"); // all | paid | unpaid
  const [histDate, setHistDate] = useState("");        // YYYY-MM-DD

  // INICIO
  const [filterPaid, setFilterPaid] = useState("all"); // all | paid | unpaid
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState({}); // { [productId]: {product, qty} }
  const [isPaid, setIsPaid] = useState(false);
  const [note, setNote] = useState(""); // observaciones (opcional)

  const dayKey = todayKey();
  const orders = useMemo(() => ordersByDay[dayKey] || [], [ordersByDay, dayKey]);

  useEffect(() => saveOrders(ordersByDay), [ordersByDay]);

  // Bloquea el scroll del body cuando hay modal abierto
  useEffect(() => {
    const lock = showNew || showHistory; // si no tienes showHistory, deja sólo showNew
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showNew, showHistory]);

  // === Carrito ===
  const addToCart = (p) => setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } }));
  const subFromCart = (p) => setCart((c) => { const q = c[p.id]?.qty || 0; if (q <= 1) { const { [p.id]: _omit, ...rest } = c; return rest; } return { ...c, [p.id]: { product: p, qty: q - 1 } }; });
  const clearCart = () => setCart({});

  const addOrder = () => {
    const items = Object.values(cart);
    if (items.length === 0) return alert("Agrega al menos un producto");
    const newOrder = {
      id: (crypto?.randomUUID?.() || String(Date.now() + Math.random())),
      at: new Date().toISOString(),
      customerName: customerName.trim() || "Sin nombre",
      phone: phone.trim(),
      items, // NUEVO: múltiples productos
      paid: !!isPaid,
      kitchen: "pending", // <-- NUEVO: 'pending' | 'preparing' | 'ready'
      note: note.trim(),
    };
    const updated = { ...ordersByDay, [dayKey]: [newOrder, ...orders] };
    setOrdersByDay(updated);
    setCustomerName(""); setPhone(""); setCart({}); setIsPaid(false); setNote(""); setShowNew(false);
  };

  const removeOrder = (id) => setOrdersByDay({ ...ordersByDay, [dayKey]: orders.filter(o => o.id !== id) });
  const togglePaid = (id) => setOrdersByDay({ ...ordersByDay, [dayKey]: orders.map(o => o.id === id ? { ...o, paid: !o.paid } : o) });
  const setKitchen = (id, value) => { setOrdersByDay(prev => ({ ...prev, [dayKey]: (prev[dayKey] || []).map(o => o.id === id ? { ...o, kitchen: value } : o) })); };

  // === Inicio: filtro y totales del día ===
  const filtered = useMemo(() => orders.filter(o => (
    filterPaid === "all" || (filterPaid === "paid" && o.paid) || (filterPaid === "unpaid" && !o.paid)
  )), [orders, filterPaid]);

  const totals = useMemo(() => {
    const total = orders.reduce((acc, o) => acc + orderTotal(o), 0);
    const cobrados = orders.filter(o => o.paid).reduce((acc, o) => acc + orderTotal(o), 0);
    const pendientes = total - cobrados;
    return { total, cobrados, pendientes };
  }, [orders]);

  // === WhatsApp resumen día actual ===
  const summaryText = () => {
    const lines = [
      `Resumen ${dayKey}`,
      `Total pedidos: ${orders.length}`,
      `Cobrado: ${currency(totals.cobrados)} | Pendiente: ${currency(totals.pendientes)} | Total: ${currency(totals.total)}`,
      "",
      ...orders.map(o => {
        const itemsText = o.items ? o.items.map(it => `${it.qty}x ${it.product.name}`).join(", ") : `${o.qty}x ${o.product.name}`;
        return `• ${o.customerName} — ${itemsText} (${currency(orderTotal(o))}) ${o.paid ? "[PAGADO]" : "[PENDIENTE]"}`;
      })
    ];
    return lines.join("\n");
  };

  const [phoneGlobal, setPhoneGlobal] = useState(localStorage.getItem("fastfood_whatsapp_admin") || "");
  useEffect(() => localStorage.setItem("fastfood_whatsapp_admin", phoneGlobal || ""), [phoneGlobal]);
  const openWhatsApp = () => {
    const text = encodeURIComponent(summaryText());
    if (phoneGlobal.trim()) window.open(`https://wa.me/${phoneGlobal.replace(/\D/g, "")}?text=${text}`, "_blank");
    else window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // === Historial (días anteriores) ===
  const prevDays = Object.keys(ordersByDay)
    .filter(d => d !== dayKey)
    .sort((a, b) => b.localeCompare(a)); // más reciente primero

  // Conjunto de pedidos del historial según filtros
  const historyList = useMemo(() => {
    // Si hay fecha elegida, solo ese día (si existe); si no, todos los prevDays
    const days = histDate ? [histDate] : prevDays;
    const list = [];
    days.forEach(d => {
      const od = ordersByDay[d] || [];
      od.forEach(o => list.push({ ...o, _day: d }));
    });
    // Filtra por estado
    return list.filter(o =>
      histStatus === "all" ||
      (histStatus === "paid" && o.paid) ||
      (histStatus === "unpaid" && !o.paid)
    );
  }, [ordersByDay, prevDays, histDate, histStatus]);

  // Totales del historial filtrado
  const historyTotals = useMemo(() => {
    const total = historyList.reduce((acc, o) => acc + orderTotal(o), 0);
    const cobrados = historyList.filter(o => o.paid).reduce((acc, o) => acc + orderTotal(o), 0);
    const pendientes = total - cobrados;
    return { total, cobrados, pendientes, count: historyList.length };
  }, [historyList]);

  // Exportar CSV de historial (vista filtrada)
  const exportHistoryCSV = () => {
    const header = ["fecha", "hora", "cliente", "telefono", "items", "total", "estado"].join(",");
    const rows = historyList.map(o => {
      const d = new Date(o.at);
      const itemsText = o.items ? o.items.map(it => `${it.qty}x ${it.product.name}`).join(" + ") : `${o.qty}x ${o.product?.name || ""}`;
      return [
        o._day || d.toISOString().slice(0, 10),
        d.toLocaleTimeString(),
        `"${o.customerName || ""}"`,
        `"${o.phone || ""}"`,
        `"${itemsText}"`,
        orderTotal(o),
        o.paid ? "PAGADO" : "PENDIENTE",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `historial_filtrado.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Exportar CSV de TODO el historial (todos los días menos hoy)
  const exportAllHistoryCSV = () => {
    const all = [];
    prevDays.forEach(d => {
      (ordersByDay[d] || []).forEach(o => all.push({ ...o, _day: d }));
    });
    const header = ["fecha", "hora", "cliente", "telefono", "items", "total", "estado"].join(",");
    const rows = all.map(o => {
      const d = new Date(o.at);
      const itemsText = o.items ? o.items.map(it => `${it.qty}x ${it.product.name}`).join(" + ") : `${o.qty}x ${o.product?.name || ""}`;
      return [
        o._day || d.toISOString().slice(0, 10),
        d.toLocaleTimeString(),
        `"${o.customerName || ""}"`,
        `"${o.phone || ""}"`,
        `"${itemsText}"`,
        orderTotal(o),
        o.paid ? "PAGADO" : "PENDIENTE",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `historial_completo.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((acc, it) => acc + it.product.price * it.qty, 0);


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 text-[13px] md:text-[14px]">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">S&S Burger — {dayKey}</h1>
            <p className="text-slate-600">Comida rápida.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow hover:opacity-90">
              <Plus size={18} /> Nueva orden
            </button>
            {/* Quitamos Exportar CSV del inicio */}
            <button onClick={() => setShowHistory(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white shadow hover:bg-slate-100">
              <History size={18} /> Historial
            </button>
            <button onClick={openWhatsApp} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white shadow hover:opacity-90">
              <Send size={18} /> Enviar resumen por WhatsApp
            </button>
          </div>
        </div>

        {/* Totales (día actual) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard title="Total del día" value={currency(totals.total)} />
          <StatCard title="Cobrado" value={currency(totals.cobrados)} />
          <StatCard title="Pendiente" value={currency(totals.pendientes)} />
        </div>

        {/* Filtros del día + WhatsApp admin */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className={`px-3 py-1.5 rounded-full border ${filterPaid === 'all' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
              <input className="hidden" type="radio" name="status" value="all" checked={filterPaid === 'all'} onChange={() => setFilterPaid('all')} />Todos
            </label>
            <label className={`px-3 py-1.5 rounded-full border ${filterPaid === 'paid' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
              <input className="hidden" type="radio" name="status" value="paid" checked={filterPaid === 'paid'} onChange={() => setFilterPaid('paid')} />Pagados
            </label>
            <label className={`px-3 py-1.5 rounded-full border ${filterPaid === 'unpaid' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
              <input className="hidden" type="radio" name="status" value="unpaid" checked={filterPaid === 'unpaid'} onChange={() => setFilterPaid('unpaid')} />Pendientes
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <label className="text-sm text-slate-600">WhatsApp administrador (para el resumen):</label>
            <input className="px-3 py-2 rounded-xl border bg-white" placeholder="Ej: 573001112233" value={phoneGlobal} onChange={(e) => setPhoneGlobal(e.target.value)} />
          </div>
        </div>



        {/* Lista de pedidos del día */}
        <div className="bg-white rounded-3xl shadow divide-y">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">Sin pedidos todavía.</div>
          )}
          {filtered.map((o) => {
            const itemsText = o.items ? o.items.map(it => `${it.qty}x ${it.product.name}`).join(" · ") : `${o.qty}x ${o.product.name}`;
            return (
              <div key={o.id} className="p-5 flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                  <ShoppingCart className="opacity-50" size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{o.customerName} <span className="text-slate-400 font-normal">• {new Date(o.at).toLocaleTimeString()}</span></div>
                  <div className="text-sm text-slate-600">{itemsText} — <span className="font-medium">{currency(orderTotal(o))}</span></div>
                  {o.phone && <div className="text-xs text-slate-500">📞 {o.phone}</div>}
                  {o.note && (
                    <div className="text-xs text-slate-500 italic mt-1">📝 {o.note}</div>)}
                </div>
                <button onClick={() => togglePaid(o.id)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${o.paid ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                  {o.paid ? <CheckCircle size={16} /> : <Circle size={16} />}
                  {o.paid ? 'Pagado' : 'Pendiente'}
                </button>
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${kitchenStyles[o.kitchen || 'pending']}`}>
                  <select
                    value={o.kitchen || 'pending'}
                    onChange={(e) => setKitchen(o.id, e.target.value)}
                    className="bg-transparent text-xs outline-none">
                    <option value="pending">Sin iniciar</option>
                    <option value="preparing">En preparación</option>
                    <option value="ready">Entregado</option>
                  </select>
                </div>
                <button onClick={() => removeOrder(o.id)} className="p-2 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Menú rápido */}
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-4">Menú rápido</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl shadow overflow-hidden">
                <img src={p.image} alt={p.name} className="w-full h-32 object-cover" />
                <div className="p-3">
                  <div className="font-medium leading-tight">{p.name}</div>
                  <div className="text-sm text-slate-500">{currency(p.price)}</div>
                  <button onClick={() => { addToCart(p); setShowNew(true); }} className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Nueva orden con este</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Nueva Orden */}
      {showNew && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 md:p-8 overflow-y-auto" onClick={() => setShowNew(false)}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[1200px] bg-white rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-2xl font-semibold flex items-center gap-2">Nueva orden</h2>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X />
              </button>
            </div>
            <div className="grid md:grid-cols-[0.75fr_1.25fr] gap-6 flex-1 min-h-0 overflow-hidden">

              {/* IZQUIERDA: datos + carrito */}
              <div className="flex flex-col min-h-0">
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Nombre del cliente</label>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-500" />
                    <input className="w-full px-4 py-3 rounded-xl border" placeholder="Ej: Briand Castro" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>

                  <label className="block text-sm font-medium">Teléfono (opcional)</label>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-slate-500" />
                    <input className="w-full px-4 py-3 rounded-xl border" placeholder="Ej: 3017352907" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>

                  <label className="inline-flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
                    <span className="inline-flex items-center gap-1">
                      <Wallet size={16} /> Marcado como pagado
                    </span>
                  </label>

                  <label className="block text-sm font-medium mt-4">Observaciones (opcional)</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border resize-none min-h-[72px]"
                    placeholder="Ej: Perro sin lechuga, poca salsa..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)} />
                </div>



                {/* Carrito */}
                <div className="mt-4 bg-slate-50 rounded-2xl p-4 border flex-1 overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Carrito</div>
                    {cartItems.length > 0 && (
                      <button onClick={clearCart} className="text-sm underline">Vaciar</button>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="text-slate-500 text-sm">Aún no has agregado productos.</div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <div className="space-y-2 flex-1 overflow-auto">
                        {cartItems.map(({ product, qty }) => (
                          <div key={product.id} className="flex items-center justify-between text-sm">
                            <div>{qty} x {product.name}</div>
                            <div className="font-medium">{currency(product.price * qty)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 mt-2">
                        <div className="font-semibold">Total</div>
                        <div className="font-semibold">{currency(cartTotal)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* DERECHA: productos */}
              <div className="flex flex-col min-h-0">
                <div className="text-sm font-medium mb-3">Selecciona productos (puedes sumar varios)</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pr-2 overflow-y-auto">
                  {products.map((p) => {
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition">
                        <div className="h-32 overflow-hidden">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                          <div className="font-medium text-sm leading-tight">{p.name}</div>
                          <div className="text-xs text-slate-500 mb-2">{currency(p.price)}</div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => subFromCart(p)} className="p-2 rounded-xl border">
                              <Minus size={14} />
                            </button>
                            <div className="min-w-8 text-center font-medium">{cart[p.id]?.qty || 0}</div>
                            <button onClick={() => addToCart(p)} className="p-2 rounded-xl border bg-slate-900 text-white">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 shrink-0">
                <button onClick={() => setShowNew(false)} className="px-5 py-2.5 rounded-2xl border">Cancelar</button>
                <button onClick={addOrder} disabled={cartItems.length === 0} className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white disabled:opacity-50">Guardar orden</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Historial */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 md:p-8"
          onClick={() => setShowHistory(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[1400px] bg-white rounded-3xl shadow-2xl p-5 md:p-7 flex flex-col max-h-[88vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <History size={18} /> Historial
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 rounded-xl hover:bg-slate-100"
              >
                <X />
              </button>
            </div>

            {/* Totales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 shrink-0">
              <StatCard title="Total (historial)" value={currency(historyTotals.total)} />
              <StatCard title="Cobrado" value={currency(historyTotals.cobrados)} />
              <StatCard title="Pendiente" value={currency(historyTotals.pendientes)} />
            </div>

            {/* Filtros (sticky) */}
            <div className="shrink-0 sticky top-0 z-10 bg-white/90 backdrop-blur rounded-2xl border p-3 mb-4">
              <div className="grid md:grid-cols-[auto_auto_auto_1fr_auto_auto] gap-2 items-center">
                <div className="flex items-center gap-2">
                  <label className={`px-3 py-1.5 rounded-full border ${histStatus === 'all' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
                    <input className="hidden" type="radio" name="histStatus" value="all"
                      checked={histStatus === 'all'} onChange={() => setHistStatus('all')} />
                    Todos
                  </label>
                  <label className={`px-3 py-1.5 rounded-full border ${histStatus === 'paid' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
                    <input className="hidden" type="radio" name="histStatus" value="paid"
                      checked={histStatus === 'paid'} onChange={() => setHistStatus('paid')} />
                    Pagados
                  </label>
                  <label className={`px-3 py-1.5 rounded-full border ${histStatus === 'unpaid' ? 'bg-slate-900 text-white' : 'bg-white'} cursor-pointer`}>
                    <input className="hidden" type="radio" name="histStatus" value="unpaid"
                      checked={histStatus === 'unpaid'} onChange={() => setHistStatus('unpaid')} />
                    Pendientes
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-slate-500" />
                  <input
                    type="date"
                    value={histDate}
                    onChange={(e) => setHistDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border w-[170px]"
                  />
                  {histDate && (
                    <button onClick={() => setHistDate('')} className="px-3 py-2 rounded-xl border">
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="md:col-start-5 flex items-center gap-2 justify-end">
                  <button
                    onClick={exportHistoryCSV}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white shadow hover:bg-slate-100"
                  >
                    <Download size={18} /> Exportar CSV (vista)
                  </button>
                  <button
                    onClick={exportAllHistoryCSV}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white shadow hover:bg-slate-100"
                  >
                    <Download size={18} /> Exportar CSV (todo)
                  </button>
                </div>
              </div>
            </div>

            {/* Lista (scroll propio) */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 divide-y">
              {historyList.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Sin resultados para los filtros seleccionados.
                </div>
              ) : (
                historyList.map((o) => {
                  const itemsText = o.items
                    ? o.items.map(it => `${it.qty}x ${it.product.name}`).join(" · ")
                    : `${o.qty}x ${o.product?.name || ""}`;
                  return (
                    <div key={o.id + (o._day || '')} className="p-4 flex items-center gap-4">
                      <div className="text-xs text-slate-500 w-28">
                        {o._day || new Date(o.at).toISOString().slice(0, 10)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {o.customerName || 'Sin nombre'}
                          <span className="text-slate-400 font-normal">
                            {' '}• {new Date(o.at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 truncate">
                          {itemsText} — <span className="font-medium">{currency(orderTotal(o))}</span>
                        </div>
                        {o.phone && <div className="text-xs text-slate-500">📞 {o.phone}</div>}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap
                                ${o.paid ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                        {o.paid ? 'Pagado' : 'Pendiente'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-2xl p-2 shadow">
      <div className="text-slate-500 text-xs">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
