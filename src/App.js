import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ════════════════════════════════════════════════════════════════
//  DATOS MOCK (se reemplazarán por queries a Supabase en próximas iteraciones)
// ════════════════════════════════════════════════════════════════
const INIT_RESERVAS = [];
const INIT_CLIENTES = [];

const PROVEEDORES = [
  { id: 1, nombre: "Tucano Tours", tipo: "Aéreos/Paquetes", cuentas: [{ id: "t1", nombre: "Tucano USD", moneda: "USD", saldo: 0 }, { id: "t2", nombre: "Tucano ARS", moneda: "ARS", saldo: 0 }] },
  { id: 2, nombre: "TBO", tipo: "Hoteles/Autos", cuentas: [{ id: "tb1", nombre: "TBO USD", moneda: "USD", saldo: 0 }] },
  { id: 3, nombre: "GEA", tipo: "Aéreos", cuentas: [{ id: "g1", nombre: "GEA USD", moneda: "USD", saldo: 0 }, { id: "g2", nombre: "GEA ARS", moneda: "ARS", saldo: 0 }] },
  { id: 4, nombre: "Altos del Arapey", tipo: "Hotel", cuentas: [{ id: "a1", nombre: "Altos Arapey USD", moneda: "USD", saldo: 0 }] },
  { id: 5, nombre: "Arapey Thermal", tipo: "Hotel", cuentas: [{ id: "at1", nombre: "Arapey Thermal USD", moneda: "USD", saldo: 0 }] },
  { id: 6, nombre: "All Seasons", tipo: "Hoteles/Autos", cuentas: [{ id: "as1", nombre: "All Seasons USD", moneda: "USD", saldo: 0 }] },
  { id: 7, nombre: "Assist Card", tipo: "Seguro", cuentas: [{ id: "ac1", nombre: "Assist Card ARS", moneda: "ARS", saldo: 0 }, { id: "ac2", nombre: "Assist Card USD", moneda: "USD", saldo: 0 }] },
  { id: 8, nombre: "Universal Assistance", tipo: "Seguro", cuentas: [{ id: "ua1", nombre: "Universal ARS", moneda: "ARS", saldo: 0 }, { id: "ua2", nombre: "Universal USD", moneda: "USD", saldo: 0 }] },
];

const CUENTAS_BANCARIAS = [
  { id: "credicoop", nombre: "Credicoop", tipo: "banco", moneda: "ARS", saldo: 0 },
  { id: "galicia", nombre: "Galicia", tipo: "banco", moneda: "ARS", saldo: 0 },
  { id: "bofa", nombre: "Bank of America", tipo: "banco", moneda: "USD", saldo: 0 },
  { id: "bofa_card", nombre: "BOFA Card", tipo: "tarjeta", moneda: "USD", saldo: 0 },
  { id: "chase", nombre: "Chase", tipo: "banco", moneda: "USD", saldo: 0 },
  { id: "chase_card", nombre: "Chase Card", tipo: "tarjeta", moneda: "USD", saldo: 0 },
  { id: "cash_usd", nombre: "Caja USD", tipo: "efectivo", moneda: "USD", saldo: 0 },
  { id: "cash_ars", nombre: "Caja ARS", tipo: "efectivo", moneda: "ARS", saldo: 0 },
];

const INIT_MOVIMIENTOS = [];

const ESTADOS_RESERVA = ["Borrador", "Pendiente", "Confirmada", "Pagada", "Cerrada", "Cancelada"];
const TIPOS_MOV = { pago_proveedor: "Pago a proveedor", cobro_cliente: "Cobro a cliente", transferencia_interna: "Transferencia interna", gasto: "Gasto operativo", retiro: "Retiro", ingreso: "Ingreso" };

// ════════════════════════════════════════════════════════════════
//  UTILIDADES
// ════════════════════════════════════════════════════════════════
const fmt = (n, m = "USD") => n == null ? "—" : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " " + m;
const fmtD = (d) => { if (!d) return "—"; const [y, mo, day] = d.split("-"); return `${day}/${mo}/${y}`; };
const hoy = () => new Date().toISOString().slice(0, 10);
const diasHasta = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date(hoy())) / 86400000); };
const noches = (a, b) => { if (!a || !b) return 0; return Math.round((new Date(b) - new Date(a)) / 86400000); };
const paxStr = (r) => { const p = []; if (r.adultos) p.push(`${r.adultos}A`); if (r.chd) p.push(`${r.chd}CHD`); if (r.inf) p.push(`${r.inf}INF`); return p.join(" · "); };

const ESTADO_C = { Borrador: "#4a6fa5", Pendiente: "#f59e0b", Confirmada: "#3b82f6", Pagada: "#10b981", Cerrada: "#6b7280", Cancelada: "#ef4444" };
const ESTADO_BG = { Borrador: "#0f2040", Pendiente: "#2d2010", Confirmada: "#0f2040", Pagada: "#0a2d1e", Cerrada: "#1a1a1a", Cancelada: "#2d0f0f" };
const MOV_C = { pago_proveedor: "#ef4444", cobro_cliente: "#10b981", transferencia_interna: "#3b82f6", gasto: "#f59e0b", retiro: "#8b5cf6", ingreso: "#10b981" };

function Badge({ estado }) {
  return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: ESTADO_BG[estado] || "#1e2a3a", color: ESTADO_C[estado] || "#94a3b8", border: `1px solid ${(ESTADO_C[estado] || "#1e3a5f")}44` }}>{estado}</span>;
}

// ════════════════════════════════════════════════════════════════
//  ESTILOS BASE
// ════════════════════════════════════════════════════════════════
const S = {
  card: { background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 12, padding: 18 },
  inp: { width: "100%", background: "#080f1a", border: "1px solid #1e3a5f", borderRadius: 7, padding: "8px 11px", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" },
  sel: { background: "#080f1a", border: "1px solid #1e3a5f", borderRadius: 7, padding: "8px 11px", color: "#e2e8f0", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" },
  fg: { marginBottom: 14 },
  fl: { display: "block", fontSize: 11, color: "#7a9cc8", marginBottom: 5, fontWeight: 500 },
  th: { padding: "9px 13px", textAlign: "left", fontSize: 10, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #1e3a5f", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "11px 13px", fontSize: 12, borderBottom: "1px solid #0a1628", verticalAlign: "middle" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,.87)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "24px 16px", overflowY: "auto" },
  mbox: (maxW = 700) => ({ background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 14, width: "100%", maxWidth: maxW, padding: 26 }),
  pt: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 },
  ps: { fontSize: 12, color: "#4a6fa5", marginBottom: 20 },
  stitle: { fontSize: 10, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #1e3a5f" },
};

function btn(v = "pri", s = "md") {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", borderRadius: 7, fontWeight: 600, fontSize: s === "sm" ? 11 : 12, padding: s === "sm" ? "5px 10px" : "9px 16px", transition: "opacity .15s" };
  const variants = { pri: { background: "#c9a84c", color: "#0d1829" }, success: { background: "#10b981", color: "#fff" }, blue: { background: "#3b82f6", color: "#fff" }, danger: { background: "#dc2626", color: "#fff" }, secondary: { background: "#1e3a5f", color: "#e2e8f0" }, ghost: { background: "transparent", color: "#7a9cc8", border: "1px solid #1e3a5f" } };
  return { ...base, ...(variants[v] || variants.secondary) };
}

function generarAlertas(reservas) {
  const alertas = [];
  reservas.forEach(r => {
    const dViaje = diasHasta(r.fecha_in);
    const dPago = diasHasta(r.vto_pago);
    const dReserva = diasHasta(r.vto_reserva);
    if (["Cerrada", "Cancelada"].includes(r.estado)) return;
    if (dPago !== null && dPago <= 5 && dPago >= 0 && !["Pagada"].includes(r.estado))
      alertas.push({ id: `pago_${r.id}`, tipo: "vencimiento_pago", reserva: r, msg: `Vence pago — ${r.proveedor}`, sub: `${r.pasajero_nombre} · ${r.codigo}`, dias: dPago, urgente: dPago <= 2 });
    if (dReserva !== null && dReserva <= 3 && dReserva >= 0)
      alertas.push({ id: `res_${r.id}`, tipo: "vencimiento_reserva", reserva: r, msg: `Vence reserva en ${dReserva === 0 ? "hoy" : dReserva + "d"}`, sub: `${r.pasajero_nombre} · ${r.codigo}`, dias: dReserva, urgente: dReserva <= 1 });
    if (dViaje !== null && dViaje <= 7 && dViaje >= 0)
      alertas.push({ id: `viaje_${r.id}`, tipo: "viaje_proximo", reserva: r, msg: `Viaje en ${dViaje === 0 ? "HOY" : dViaje + " días"} — ${r.destino}`, sub: `${r.pasajero_nombre} · ${r.codigo}`, dias: dViaje, urgente: dViaje <= 2 });
    if (r.pasaporte_vto && r.fecha_in && r.pasaporte_vto < r.fecha_in)
      alertas.push({ id: `pas_${r.id}`, tipo: "pasaporte", reserva: r, msg: `Pasaporte vence antes del viaje`, sub: `${r.pasajero_nombre} · vto: ${fmtD(r.pasaporte_vto)}`, dias: null, urgente: true });
    if (!r.seguro && dViaje !== null && dViaje <= 30)
      alertas.push({ id: `seg_${r.id}`, tipo: "sin_seguro", reserva: r, msg: `Sin seguro de viaje`, sub: `${r.pasajero_nombre} — ${r.destino}`, dias: dViaje, urgente: dViaje <= 7 });
  });
  return alertas.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
}

// ════════════════════════════════════════════════════════════════
//  COMPONENTES COMPARTIDOS
// ════════════════════════════════════════════════════════════════
function Stat({ label, value, color = "#c9a84c", sub }) {
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a6fa5", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Tabla({ cols, rows, empty = "Sin resultados" }) {
  return (
    <div style={{ ...S.card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{cols.map(c => <th key={c.k || c} style={S.th}>{c.label || c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={cols.length} style={{ ...S.td, textAlign: "center", color: "#4a6fa5", padding: 40 }}>{empty}</td></tr> : rows}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  LOGIN — usa Supabase Auth real
// ════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function intentar() {
    setLoading(true);
    setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      setErr("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }
    // Obtener perfil del usuario
    const { data: perfil } = await supabase.from("usuarios").select("*").eq("id", data.user.id).single();
    onLogin(perfil || { nombre: email.split("@")[0], email, rol: "vendedor", iniciales: email.slice(0,2).toUpperCase(), color: "#3b82f6" });
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: 380, padding: 40, background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#c9a84c", letterSpacing: 3, textTransform: "uppercase" }}>LUCKY TOUR</div>
          <div style={{ fontSize: 11, color: "#4a6fa5", letterSpacing: 3, marginTop: 4, textTransform: "uppercase" }}>Sistema de gestión</div>
        </div>
        <div style={S.fg}>
          <label style={S.fl}>Email</label>
          <input style={S.inp} value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && intentar()} placeholder="tu@luckytourviajes.com" autoComplete="email" />
        </div>
        <div style={S.fg}>
          <label style={S.fl}>Contraseña</label>
          <input style={S.inp} type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && intentar()} placeholder="••••••••" autoComplete="current-password" />
        </div>
        {err && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12 }}>{err}</div>}
        <button style={{ ...btn("pri"), width: "100%", justifyContent: "center", padding: "12px", opacity: loading ? 0.7 : 1 }} onClick={intentar} disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { id: "dashboard", icon: "◉", label: "Dashboard" },
  { id: "reservas", icon: "✈", label: "Reservas" },
  { id: "clientes", icon: "👤", label: "Clientes" },
  { id: "proveedores", icon: "🏢", label: "Proveedores" },
  { id: "finanzas", icon: "💰", label: "Finanzas" },
  { id: "alertas", icon: "🔔", label: "Alertas" },
  { id: "documentos", icon: "📄", label: "Documentos" },
];

function Sidebar({ page, setPage, alertasCount, user, onLogout, collapsed, setCollapsed }) {
  return (
    <div style={{ width: collapsed ? 56 : 210, flexShrink: 0, background: "#0a1322", borderRight: "1px solid #1e3a5f", display: "flex", flexDirection: "column", transition: "width .2s", overflow: "hidden" }}>
      <div style={{ padding: collapsed ? "20px 0" : "20px 16px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && <div style={{ fontSize: 14, fontWeight: 900, color: "#c9a84c", letterSpacing: 2, textTransform: "uppercase" }}>Lucky Tour</div>}
        <button style={{ ...btn("ghost", "sm"), padding: "4px 7px", fontSize: 14 }} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "▶" : "◀"}</button>
      </div>
      <div style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {NAV_ITEMS.map(item => {
          const active = page === item.id;
          const badge = item.id === "alertas" && alertasCount > 0;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: collapsed ? "12px 0" : "11px 16px", justifyContent: collapsed ? "center" : "flex-start", border: "none", background: active ? "#1e3a5f" : "transparent", color: active ? "#c9a84c" : "#4a6fa5", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent", position: "relative" }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
              {badge && <span style={{ position: collapsed ? "absolute" : "static", top: 8, right: 8, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{alertasCount}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: collapsed ? "12px 0" : "12px 16px", borderTop: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1e3a5f", border: `2px solid ${user?.color || "#c9a84c"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: user?.color || "#c9a84c", flexShrink: 0 }}>{user?.iniciales || "?"}</div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.nombre?.split(" ")[0] || user?.email}</div>
            <div style={{ fontSize: 9, color: "#4a6fa5", textTransform: "uppercase" }}>{user?.rol || "usuario"}</div>
          </div>
        )}
        {!collapsed && <button style={{ ...btn("ghost", "sm"), padding: "3px 7px", fontSize: 10 }} onClick={onLogout}>Salir</button>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════
function Dashboard({ reservas, movimientos, alertas, setPage }) {
  const activas = reservas.filter(r => !["Cerrada", "Cancelada"].includes(r.estado)).length;
  const proximas = reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).length;
  const urgentes = alertas.filter(a => a.urgente).length;
  const margen = reservas.filter(r => r.estado !== "Cancelada").reduce((s, r) => s + (r.venta - r.neto), 0);

  return (
    <div>
      <div style={S.pt}>Dashboard</div>
      <div style={{ ...S.ps, marginBottom: 24 }}>Buenos días · {fmtD(hoy())}</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Reservas activas" value={activas} />
        <Stat label="Viajes próximos 30d" value={proximas} color="#3b82f6" />
        <Stat label="Alertas urgentes" value={urgentes} color={urgentes > 0 ? "#ef4444" : "#10b981"} />
        <Stat label="Margen acum. USD" value={fmt(margen, "USD")} color="#10b981" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={S.stitle}>🚨 Alertas urgentes</div>
          {alertas.filter(a => a.urgente).slice(0, 5).map(a => (
            <div key={a.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{a.msg}</div>
                <div style={{ fontSize: 10, color: "#7a9cc8", marginTop: 1 }}>{a.sub}</div>
              </div>
              {a.dias !== null && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>{a.dias === 0 ? "HOY" : `${a.dias}d`}</span>}
            </div>
          ))}
          {alertas.filter(a => a.urgente).length === 0 && <div style={{ fontSize: 12, color: "#10b981" }}>✅ Sin urgencias</div>}
          <button style={{ ...btn("ghost", "sm"), marginTop: 12 }} onClick={() => setPage("alertas")}>Ver todas →</button>
        </div>
        <div style={S.card}>
          <div style={S.stitle}>✈️ Próximos viajes</div>
          {reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).sort((a, b) => a.fecha_in.localeCompare(b.fecha_in)).slice(0, 5).map(r => {
            const d = diasHasta(r.fecha_in);
            return (
              <div key={r.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.pasajero_nombre.split(" ")[0]} — {r.destino}</div>
                  <div style={{ fontSize: 10, color: "#7a9cc8" }}>{fmtD(r.fecha_in)} · {r.codigo}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: d <= 3 ? "#ef4444" : d <= 7 ? "#f59e0b" : "#3b82f6", flexShrink: 0 }}>{d === 0 ? "HOY" : `${d}d`}</span>
              </div>
            );
          })}
          {reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>Sin viajes en 30 días</div>}
        </div>
        <div style={S.card}>
          <div style={S.stitle}>💳 Vencimientos de pago</div>
          {reservas.filter(r => { const d = diasHasta(r.vto_pago); return d !== null && d <= 14 && d >= 0 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado); }).sort((a, b) => a.vto_pago.localeCompare(b.vto_pago)).map(r => {
            const d = diasHasta(r.vto_pago);
            return (
              <div key={r.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.proveedor}</div>
                  <div style={{ fontSize: 10, color: "#7a9cc8" }}>{r.pasajero_nombre.split(" ")[0]} · {fmt(r.neto, r.moneda)}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: d <= 2 ? "#ef4444" : "#f59e0b", flexShrink: 0 }}>{d === 0 ? "HOY" : `${d}d`}</span>
              </div>
            );
          })}
          {reservas.filter(r => { const d = diasHasta(r.vto_pago); return d !== null && d <= 14 && d >= 0 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado); }).length === 0 && <div style={{ fontSize: 12, color: "#10b981" }}>✅ Sin pagos urgentes</div>}
        </div>
        <div style={S.card}>
          <div style={S.stitle}>🔄 Últimos movimientos</div>
          {[...movimientos].reverse().slice(0, 5).map(m => {
            const esCobro = m.tipo === "cobro_cliente" || m.tipo === "ingreso";
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto}</div>
                  <div style={{ fontSize: 10, color: "#4a6fa5" }}>{fmtD(m.fecha)}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: esCobro ? "#10b981" : "#ef4444", flexShrink: 0 }}>
                  {esCobro ? "+" : "-"}{fmt(m.monto_origen, m.moneda_origen)}
                </span>
              </div>
            );
          })}
          <button style={{ ...btn("ghost", "sm"), marginTop: 12 }} onClick={() => setPage("finanzas")}>Ver finanzas →</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  RESERVAS
// ════════════════════════════════════════════════════════════════
function Reservas({ reservas, setReservas }) {
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalEstado, setModalEstado] = useState(null);
  const [modalDoc, setModalDoc] = useState(null);

  const lista = reservas.filter(r => {
    const s = q.toLowerCase();
    return (!q || r.pasajero_nombre.toLowerCase().includes(s) || r.codigo.toLowerCase().includes(s) || r.destino.toLowerCase().includes(s))
      && (!filtroEstado || r.estado === filtroEstado);
  });

  function handleEstado(reserva, nuevoEstado, enviarConfirmacion) {
    setReservas(rs => rs.map(r => r.id === reserva.id ? {
      ...r, estado: nuevoEstado,
      docs: enviarConfirmacion ? [...r.docs, { tipo: "confirmacion", fecha: hoy(), asunto: `✅ Confirmación — ${r.destino}` }] : r.docs
    } : r));
    setModalEstado(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={S.pt}>Reservas</div><div style={S.ps}>{lista.length} reservas</div></div>
        <button style={btn("pri")}>+ Nueva reserva</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input style={{ ...S.inp, maxWidth: 280 }} placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...S.sel, maxWidth: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_RESERVA.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <Tabla
        cols={[{ k: "cod", label: "Código" }, { k: "pax", label: "Pasajero" }, { k: "dest", label: "Destino" }, { k: "fechas", label: "Fechas" }, { k: "venta", label: "Venta" }, { k: "vto", label: "Vto pago" }, { k: "estado", label: "Estado" }, { k: "acc", label: "" }]}
        rows={lista.map(r => {
          const dPago = diasHasta(r.vto_pago);
          const pagoUrgente = dPago !== null && dPago <= 3 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado);
          return (
            <tr key={r.id} style={{ background: "#0d1829" }}>
              <td style={{ ...S.td, fontFamily: "monospace", color: "#c9a84c", fontSize: 11 }}>{r.codigo}</td>
              <td style={S.td}><div style={{ fontWeight: 500 }}>{r.pasajero_nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.tipo}</div></td>
              <td style={S.td}><div>{r.destino}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.proveedor}</div></td>
              <td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(r.fecha_in)} → {fmtD(r.fecha_out)}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{fmt(r.venta, r.moneda)}</td>
              <td style={S.td}><span style={{ fontSize: 11, color: pagoUrgente ? "#ef4444" : "#7a9cc8", fontWeight: pagoUrgente ? 700 : 400 }}>{pagoUrgente ? "⚠️ " : ""}{fmtD(r.vto_pago)}</span></td>
              <td style={S.td}><Badge estado={r.estado} /></td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 5 }}>
                  <button style={btn("ghost", "sm")} onClick={() => setModalEstado(r)}>Estado</button>
                  <button style={btn("secondary", "sm")} onClick={() => setModalDoc(r)}>Docs</button>
                </div>
              </td>
            </tr>
          );
        })}
      />
      {modalEstado && (
        <div style={S.modal} onClick={() => setModalEstado(null)}>
          <div style={{ ...S.mbox(460) }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontWeight: 700 }}>Cambiar estado — {modalEstado.codigo}</div>
              <button style={btn("ghost", "sm")} onClick={() => setModalEstado(null)}>✕</button>
            </div>
            <EstadoForm reserva={modalEstado} onConfirm={handleEstado} onClose={() => setModalEstado(null)} />
          </div>
        </div>
      )}
      {modalDoc && (
        <div style={S.modal} onClick={() => setModalDoc(null)}>
          <div style={{ ...S.mbox(560) }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontWeight: 700 }}>Documentos — {modalDoc.codigo}</div>
              <button style={btn("ghost", "sm")} onClick={() => setModalDoc(null)}>✕</button>
            </div>
            <DocsForm reserva={modalDoc} onUpdate={r => { setReservas(rs => rs.map(x => x.id === r.id ? r : x)); setModalDoc(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoForm({ reserva, onConfirm, onClose }) {
  const [estado, setEstado] = useState(reserva.estado);
  const vaAConfirmada = estado === "Confirmada" && reserva.estado !== "Confirmada";
  const vaAPagada = estado === "Pagada" && reserva.estado !== "Pagada";
  return (
    <>
      <div style={S.fg}><label style={S.fl}>Nuevo estado</label><select style={S.sel} value={estado} onChange={e => setEstado(e.target.value)}>{ESTADOS_RESERVA.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
      {vaAConfirmada && <div style={{ padding: "12px 14px", background: "#0f2040", border: "1px solid #3b82f644", borderRadius: 8, marginBottom: 14, fontSize: 11, color: "#7a9cc8" }}>✅ <strong style={{ color: "#3b82f6" }}>Se enviará confirmación automáticamente.</strong></div>}
      {vaAPagada && <div style={{ padding: "12px 14px", background: "#0a2d1e", border: "1px solid #10b98144", borderRadius: 8, marginBottom: 14, fontSize: 11, color: "#7a9cc8" }}>🎫 <strong style={{ color: "#10b981" }}>Se habilitará el envío del voucher.</strong></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={btn("ghost")} onClick={onClose}>Cancelar</button>
        <button style={btn("pri")} onClick={() => onConfirm(reserva, estado, vaAConfirmada)}>{vaAConfirmada ? "Confirmar y enviar" : "Guardar"}</button>
      </div>
    </>
  );
}

function DocsForm({ reserva, onUpdate }) {
  const [tipo, setTipo] = useState("confirmacion");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const puedeVoucher = reserva.estado === "Pagada";

  function enviar() {
    setEnviando(true);
    setTimeout(() => {
      setEnviando(false); setEnviado(true);
      setTimeout(() => onUpdate({ ...reserva, docs: [...reserva.docs, { tipo, fecha: hoy(), asunto: tipo === "confirmacion" ? `✅ Confirmación — ${reserva.destino}` : `🎫 Voucher — ${reserva.destino}` }] }), 1200);
    }, 1800);
  }

  if (enviado) return <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 48, marginBottom: 10 }}>✅</div><div style={{ fontWeight: 700, color: "#10b981" }}>Enviado</div></div>;

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={{ ...btn(tipo === "confirmacion" ? "blue" : "ghost"), flex: 1, justifyContent: "center" }} onClick={() => setTipo("confirmacion")}>✅ Confirmación</button>
        <button style={{ ...btn(tipo === "voucher" ? "success" : "ghost"), flex: 1, justifyContent: "center", opacity: puedeVoucher ? 1 : 0.4, cursor: puedeVoucher ? "pointer" : "not-allowed" }} onClick={() => puedeVoucher && setTipo("voucher")}>🎫 Voucher {!puedeVoucher && "(req: Pagada)"}</button>
      </div>
      <div style={{ padding: "12px 14px", background: "#080f1a", borderRadius: 8, marginBottom: 16, fontSize: 11, color: "#4a6fa5" }}>
        Para: <strong style={{ color: "#e2e8f0" }}>{reserva.pasajero_nombre}</strong> — {reserva.pasajero_mail}
      </div>
      {reserva.docs.length > 0 && <div style={{ marginBottom: 14 }}>{reserva.docs.map((d, i) => <div key={i} style={{ fontSize: 11, padding: "5px 10px", background: "#080f1a", borderRadius: 6, marginBottom: 4 }}>{d.tipo === "confirmacion" ? "✅" : "🎫"} {d.asunto} · {fmtD(d.fecha)}</div>)}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={{ ...btn(tipo === "confirmacion" ? "blue" : "success"), opacity: enviando ? 0.7 : 1 }} onClick={enviar} disabled={enviando}>{enviando ? "Enviando..." : tipo === "confirmacion" ? "✅ Enviar confirmación" : "🎫 Enviar voucher"}</button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  CLIENTES
// ════════════════════════════════════════════════════════════════
function Clientes({ clientes, reservas }) {
  const [q, setQ] = useState("");
  const lista = clientes.filter(c => !q || `${c.nombre} ${c.apellido}`.toLowerCase().includes(q.toLowerCase()) || c.dni?.includes(q));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={S.pt}>Clientes</div><div style={S.ps}>{lista.length} pasajeros</div></div>
        <button style={btn("pri")}>+ Nuevo cliente</button>
      </div>
      <input style={{ ...S.inp, maxWidth: 320, marginBottom: 16 }} placeholder="Buscar por nombre o DNI..." value={q} onChange={e => setQ(e.target.value)} />
      <Tabla
        cols={[{ k: "nom", label: "Nombre" }, { k: "doc", label: "DNI / Pasaporte" }, { k: "cont", label: "Contacto" }, { k: "pas", label: "Pasaporte" }, { k: "res", label: "Reservas" }]}
        rows={lista.map(c => {
          const pasVto = diasHasta(c.pasaporte_vto);
          const pasVencido = pasVto !== null && pasVto < 0;
          const pasUrgente = pasVto !== null && pasVto >= 0 && pasVto <= 90;
          return (
            <tr key={c.id}>
              <td style={S.td}><div style={{ fontWeight: 600 }}>{c.nombre} {c.apellido}</div></td>
              <td style={S.td}><div style={{ fontSize: 11 }}>🪪 {c.dni}</div><div style={{ fontSize: 11, color: "#4a6fa5" }}>📘 {c.pasaporte || "—"}</div></td>
              <td style={S.td}><div style={{ fontSize: 11 }}>{c.tel}</div><div style={{ fontSize: 11, color: "#4a6fa5" }}>{c.mail}</div></td>
              <td style={S.td}><span style={{ fontSize: 11, color: pasVencido ? "#ef4444" : pasUrgente ? "#f59e0b" : "#10b981", fontWeight: 600 }}>{pasVencido ? "⚠️ Vencido" : pasUrgente ? `⚠️ ${pasVto}d` : "✅"}{c.pasaporte_vto ? ` ${fmtD(c.pasaporte_vto)}` : ""}</span></td>
              <td style={S.td}><strong>{reservas.filter(r => r.pasajero_id === c.id).length}</strong></td>
            </tr>
          );
        })}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  PROVEEDORES
// ════════════════════════════════════════════════════════════════
function Proveedores() {
  return (
    <div>
      <div style={S.pt}>Proveedores</div>
      <div style={S.ps}>Saldos de cuentas</div>
      {PROVEEDORES.map(p => (
        <div key={p.id} style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div><div style={{ fontWeight: 700 }}>{p.nombre}</div><div style={{ fontSize: 11, color: "#4a6fa5" }}>{p.tipo}</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {p.cuentas.map(c => (
              <div key={c.id} style={{ padding: "10px 14px", background: "#080f1a", borderRadius: 8, minWidth: 160 }}>
                <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 4 }}>{c.nombre}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.saldo >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo, c.moneda)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  FINANZAS
// ════════════════════════════════════════════════════════════════
function Finanzas({ movimientos, setMovimientos }) {
  const [subPage, setSubPage] = useState("resumen");
  const totalUSD = CUENTAS_BANCARIAS.filter(c => c.moneda === "USD").reduce((s, c) => s + c.saldo, 0);
  const totalARS = CUENTAS_BANCARIAS.filter(c => c.moneda === "ARS").reduce((s, c) => s + c.saldo, 0);
  const SUB = [{ id: "resumen", l: "Resumen" }, { id: "movimientos", l: "Movimientos" }, { id: "bancos", l: "Bancos" }];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={S.pt}>Finanzas</div>
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#080f1a", borderRadius: 8, padding: 4 }}>
        {SUB.map(s => <button key={s.id} style={{ ...btn(subPage === s.id ? "secondary" : "ghost", "sm"), flex: 1, justifyContent: "center" }} onClick={() => setSubPage(s.id)}>{s.l}</button>)}
      </div>
      {subPage === "resumen" && (
        <div>
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <Stat label="Posición USD" value={fmt(totalUSD, "USD")} color={totalUSD >= 0 ? "#10b981" : "#ef4444"} />
            <Stat label="Posición ARS" value={fmt(totalARS, "ARS")} color={totalARS >= 0 ? "#10b981" : "#ef4444"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <div style={S.stitle}>🏦 Cuentas propias</div>
              {CUENTAS_BANCARIAS.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#080f1a", borderRadius: 6, marginBottom: 5 }}>
                  <div><div style={{ fontSize: 12, fontWeight: 500 }}>{c.nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{c.tipo} · {c.moneda}</div></div>
                  <span style={{ fontWeight: 700, fontSize: 12, color: c.saldo >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo, c.moneda)}</span>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.stitle}>🏢 Proveedores</div>
              {PROVEEDORES.map(p => (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a9cc8", marginBottom: 4 }}>{p.nombre}</div>
                  {p.cuentas.map(c => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "#080f1a", borderRadius: 5, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "#4a6fa5" }}>{c.nombre}</span>
                      <span style={{ fontWeight: 700, fontSize: 11, color: c.saldo >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo, c.moneda)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {subPage === "movimientos" && (
        <Tabla
          cols={[{ k: "f", label: "Fecha" }, { k: "t", label: "Tipo" }, { k: "c", label: "Concepto" }, { k: "m", label: "Monto" }, { k: "r", label: "Reserva" }]}
          rows={[...movimientos].reverse().map(m => {
            const esCobro = m.tipo === "cobro_cliente" || m.tipo === "ingreso";
            return (
              <tr key={m.id}>
                <td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(m.fecha)}</td>
                <td style={S.td}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#1e2a3a", color: MOV_C[m.tipo] || "#94a3b8" }}>{TIPOS_MOV[m.tipo]}</span></td>
                <td style={{ ...S.td, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto}</td>
                <td style={{ ...S.td, fontWeight: 700, color: esCobro ? "#10b981" : "#ef4444" }}>{esCobro ? "+" : "-"}{fmt(m.monto_origen, m.moneda_origen)}</td>
                <td style={{ ...S.td, fontSize: 11, color: "#c9a84c", fontFamily: "monospace" }}>{m.reserva_cod || "—"}</td>
              </tr>
            );
          })}
        />
      )}
      {subPage === "bancos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {CUENTAS_BANCARIAS.map(c => (
            <div key={c.id} style={{ ...S.card, borderColor: c.saldo < 0 ? "#ef444433" : "#1e3a5f" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{c.nombre}</div>
              <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 10, textTransform: "capitalize" }}>{c.tipo} · {c.moneda}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.saldo >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo, c.moneda)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  ALERTAS
// ════════════════════════════════════════════════════════════════
const ALERTA_CFG = {
  vencimiento_pago: { icon: "💳", color: "#ef4444", label: "Venc. pago" },
  vencimiento_reserva: { icon: "⏰", color: "#f59e0b", label: "Venc. reserva" },
  viaje_proximo: { icon: "✈️", color: "#3b82f6", label: "Viaje próximo" },
  pasaporte: { icon: "🛂", color: "#f59e0b", label: "Pasaporte" },
  sin_seguro: { icon: "🛡️", color: "#8b5cf6", label: "Sin seguro" },
};

function Alertas({ alertas, onDescartar }) {
  const urgentes = alertas.filter(a => a.urgente);
  const normales = alertas.filter(a => !a.urgente);

  function AlertaItem({ a }) {
    const cfg = ALERTA_CFG[a.tipo] || { icon: "⚠️", color: "#94a3b8", label: "" };
    return (
      <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: a.urgente ? "#1a0a0a" : "#0d1829", border: `1px solid ${a.urgente ? cfg.color + "44" : "#1e3a5f"}`, borderRadius: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{a.msg}</span>
            {a.urgente && <span style={{ fontSize: 9, fontWeight: 700, background: cfg.color, color: "#fff", padding: "1px 6px", borderRadius: 8 }}>URGENTE</span>}
          </div>
          <div style={{ fontSize: 11, color: "#7a9cc8" }}>{a.sub}</div>
        </div>
        <button style={btn("ghost", "sm")} onClick={() => onDescartar(a.id)}>✓</button>
      </div>
    );
  }

  return (
    <div>
      <div style={S.pt}>Alertas</div>
      <div style={S.ps}>{alertas.length} activas · {urgentes.length} urgentes</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Urgentes" value={urgentes.length} color="#ef4444" />
        <Stat label="Venc. pago" value={alertas.filter(a => a.tipo === "vencimiento_pago").length} color="#f59e0b" />
        <Stat label="Viajes próximos" value={alertas.filter(a => a.tipo === "viaje_proximo").length} color="#3b82f6" />
      </div>
      {urgentes.length > 0 && <div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🚨 Urgentes</div>{urgentes.map(a => <AlertaItem key={a.id} a={a} />)}</div>}
      {normales.length > 0 && <div><div style={{ fontSize: 10, fontWeight: 700, color: "#7a9cc8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📋 Avisos</div>{normales.map(a => <AlertaItem key={a.id} a={a} />)}</div>}
      {alertas.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 60 }}><div style={{ fontSize: 40, marginBottom: 10 }}>✅</div><div style={{ color: "#10b981", fontWeight: 600 }}>Sin alertas activas</div></div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DOCUMENTOS
// ════════════════════════════════════════════════════════════════
function Documentos({ reservas, setReservas }) {
  const disponibles = reservas.filter(r => !["Cancelada"].includes(r.estado));
  const [sel, setSel] = useState(null);

  function handleEnvio(r, tipo) {
    setReservas(rs => rs.map(x => x.id === r.id ? { ...x, docs: [...x.docs, { tipo, fecha: hoy(), asunto: tipo === "confirmacion" ? `✅ Confirmación — ${r.destino}` : `🎫 Voucher — ${r.destino}` }] } : x));
    setSel(null);
  }

  return (
    <div>
      <div style={S.pt}>Documentos</div>
      <div style={S.ps}>Confirmaciones y vouchers</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Reservas</div>
          {disponibles.map(r => {
            const puedeVoucher = r.estado === "Pagada";
            const puedeConf = ["Confirmada", "Pagada"].includes(r.estado);
            return (
              <div key={r.id} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
                  <span style={{ marginLeft: 8 }}><Badge estado={r.estado} /></span>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{r.pasajero_nombre}</div>
                  <div style={{ fontSize: 11, color: "#7a9cc8" }}>{r.destino} · {fmtD(r.fecha_in)}</div>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ ...btn(puedeConf ? "blue" : "ghost", "sm"), opacity: puedeConf ? 1 : 0.4, cursor: puedeConf ? "pointer" : "not-allowed" }} onClick={() => puedeConf && setSel({ r, tipo: "confirmacion" })}>
                    ✅ {r.docs.some(d => d.tipo === "confirmacion") ? "Re-enviar" : "Confirmación"}
                  </button>
                  <button style={{ ...btn(puedeVoucher ? "success" : "ghost", "sm"), opacity: puedeVoucher ? 1 : 0.4, cursor: puedeVoucher ? "pointer" : "not-allowed" }} onClick={() => puedeVoucher && setSel({ r, tipo: "voucher" })}>
                    🎫 {r.docs.some(d => d.tipo === "voucher") ? "Re-enviar" : "Voucher"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Historial</div>
          <div style={S.card}>
            {reservas.flatMap(r => r.docs.map(d => ({ ...d, reserva_cod: r.codigo, pasajero: r.pasajero_nombre }))).sort((a, b) => b.fecha?.localeCompare(a.fecha || "")).map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #0f2040" }}>
                <span style={{ fontSize: 18 }}>{d.tipo === "confirmacion" ? "✅" : "🎫"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{d.asunto}</div>
                  <div style={{ fontSize: 10, color: "#4a6fa5" }}>{d.pasajero} · {fmtD(d.fecha)}</div>
                </div>
              </div>
            ))}
            {reservas.flatMap(r => r.docs).length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>Sin envíos</div>}
          </div>
        </div>
      </div>
      {sel && (
        <div style={S.modal} onClick={() => setSel(null)}>
          <div style={{ ...S.mbox(480) }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontWeight: 700 }}>{sel.tipo === "confirmacion" ? "✅ Enviar confirmación" : "🎫 Enviar voucher"}</div>
              <button style={btn("ghost", "sm")} onClick={() => setSel(null)}>✕</button>
            </div>
            <div style={{ padding: "14px", background: "#080f1a", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <strong>{sel.r.pasajero_nombre}</strong> — {sel.r.pasajero_mail}<br />
              <span style={{ color: "#4a6fa5" }}>{sel.r.codigo} · {sel.r.destino} · {fmtD(sel.r.fecha_in)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btn("ghost")} onClick={() => setSel(null)}>Cancelar</button>
              <button style={btn(sel.tipo === "confirmacion" ? "blue" : "success")} onClick={() => handleEnvio(sel.r, sel.tipo)}>
                {sel.tipo === "confirmacion" ? "✅ Confirmar envío" : "🎫 Confirmar envío"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [reservas, setReservas] = useState(INIT_RESERVAS);
  const [clientes] = useState(INIT_CLIENTES);
  const [movimientos, setMovimientos] = useState(INIT_MOVIMIENTOS);
  const [alertasDescartadas, setAlertasDescartadas] = useState([]);

  // Verificar sesión activa al cargar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from("usuarios").select("*").eq("id", session.user.id).single()
          .then(({ data }) => {
            setUser(data || { nombre: session.user.email, email: session.user.email, rol: "vendedor", iniciales: session.user.email.slice(0, 2).toUpperCase(), color: "#3b82f6" });
          });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const alertasAll = generarAlertas(reservas).filter(a => !alertasDescartadas.includes(a.id));
  const alertasUrgentes = alertasAll.filter(a => a.urgente).length;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#c9a84c", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Cargando...</div>
    </div>
  );

  if (!user) return <Login onLogin={setUser} />;

  const pageProps = { reservas, setReservas, clientes, movimientos, setMovimientos, alertas: alertasAll, setPage, user };

  return (
    <div style={{ minHeight: "100vh", background: "#080f1a", color: "#e2e8f0", fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex" }}>
      <Sidebar page={page} setPage={setPage} alertasCount={alertasUrgentes} user={user} onLogout={handleLogout} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ background: "#0d1829", borderBottom: "1px solid #1e3a5f", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#7a9cc8" }}>
            {NAV_ITEMS.find(n => n.id === page)?.icon} &nbsp;
            <strong style={{ color: "#e2e8f0" }}>{NAV_ITEMS.find(n => n.id === page)?.label}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {alertasUrgentes > 0 && <button style={{ ...btn("ghost", "sm"), color: "#ef4444", borderColor: "#ef444433" }} onClick={() => setPage("alertas")}>🚨 {alertasUrgentes} urgente{alertasUrgentes > 1 ? "s" : ""}</button>}
            <span style={{ fontSize: 11, color: "#4a6fa5" }}>{fmtD(hoy())}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {page === "dashboard" && <Dashboard {...pageProps} />}
          {page === "reservas" && <Reservas {...pageProps} />}
          {page === "clientes" && <Clientes {...pageProps} />}
          {page === "proveedores" && <Proveedores />}
          {page === "finanzas" && <Finanzas {...pageProps} />}
          {page === "alertas" && <Alertas alertas={alertasAll} onDescartar={id => setAlertasDescartadas(d => [...d, id])} />}
          {page === "documentos" && <Documentos reservas={reservas} setReservas={setReservas} />}
        </div>
      </div>
    </div>
  );
}
