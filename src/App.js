import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const ESTADOS_RESERVA = ["Borrador", "Pendiente", "Confirmada", "Pagada", "Cerrada", "Cancelada"];
const TIPOS_RESERVA = ["Aéreo", "Hotel", "Paquete", "Terrestre", "Crucero", "Otro"];
const TIPOS_MOV = { pago_proveedor: "Pago a proveedor", cobro_cliente: "Cobro a cliente", transferencia_interna: "Transferencia interna", gasto: "Gasto operativo", retiro: "Retiro", ingreso: "Ingreso" };
const ESTADO_C = { Borrador: "#4a6fa5", Pendiente: "#f59e0b", Confirmada: "#3b82f6", Pagada: "#10b981", Cerrada: "#6b7280", Cancelada: "#ef4444" };
const ESTADO_BG = { Borrador: "#0f2040", Pendiente: "#2d2010", Confirmada: "#0f2040", Pagada: "#0a2d1e", Cerrada: "#1a1a1a", Cancelada: "#2d0f0f" };
const MOV_C = { pago_proveedor: "#ef4444", cobro_cliente: "#10b981", transferencia_interna: "#3b82f6", gasto: "#f59e0b", retiro: "#8b5cf6", ingreso: "#10b981" };

const fmt = (n, m = "USD") => n == null ? "—" : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " " + m;
const fmtD = (d) => { if (!d) return "—"; const [y, mo, day] = String(d).slice(0, 10).split("-"); return day + "/" + mo + "/" + y; };
const hoy = () => new Date().toISOString().slice(0, 10);
const diasHasta = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date(hoy())) / 86400000); };
const noches = (a, b) => { if (!a || !b) return 0; return Math.round((new Date(b) - new Date(a)) / 86400000); };

// Envío de mails via Vercel API
async function sendEmail(to, subject, html) {
  if (!to) return { ok: false, error: "Sin email" };
  try {
    const r = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function htmlConfirmacion(r) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:20px">
  <div style="background:#0d1829;padding:24px;border-radius:12px;text-align:center;margin-bottom:20px">
    <h1 style="color:#c9a84c;margin:0;font-size:22px;letter-spacing:3px">LUCKY TOUR</h1>
    <p style="color:#7a9cc8;margin:8px 0 0;font-size:12px">CONFIRMACIÓN DE RESERVA</p>
  </div>
  <div style="background:#fff;padding:24px;border-radius:12px;margin-bottom:16px">
    <h2 style="color:#0d1829;margin:0 0 16px">¡Tu reserva está confirmada!</h2>
    <p style="color:#374151;margin:0 0 20px">Hola <strong>${r.pasajero_nombre}</strong>, te confirmamos tu reserva con los siguientes datos:</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Código</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-family:monospace;color:#c9a84c">${r.codigo}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Destino</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600">${r.destino}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${r.tipo}${r.habitacion ? " · " + r.habitacion : ""}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Fecha de entrada</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${fmtD(r.fecha_in)}${r.fecha_out ? " → " + fmtD(r.fecha_out) : ""}</td></tr>
      ${r.proveedor_nombre ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Proveedor</td><td style="padding:8px 0">${r.proveedor_nombre}</td></tr>` : ""}
    </table>
  </div>
  ${r.notas ? `<div style="background:#fef9e7;padding:16px;border-radius:8px;margin-bottom:16px;border-left:4px solid #c9a84c"><p style="margin:0;font-size:13px;color:#374151">${r.notas}</p></div>` : ""}
  <div style="background:#0d1829;padding:16px;border-radius:8px;text-align:center">
    <p style="color:#7a9cc8;margin:0;font-size:12px">¿Consultas? Contactanos: guido@luckytourviajes.com</p>
    <p style="color:#4a6fa5;margin:4px 0 0;font-size:11px">Lucky Tour Viajes</p>
  </div>
</div>`;
}

function htmlVoucher(r) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:20px">
  <div style="background:#0d1829;padding:24px;border-radius:12px;text-align:center;margin-bottom:20px">
    <h1 style="color:#c9a84c;margin:0;font-size:22px;letter-spacing:3px">LUCKY TOUR</h1>
    <p style="color:#7a9cc8;margin:8px 0 0;font-size:12px">VOUCHER DE VIAJE</p>
  </div>
  <div style="background:#fff;padding:24px;border-radius:12px;margin-bottom:16px">
    <div style="background:#10b981;color:#fff;padding:8px 16px;border-radius:20px;display:inline-block;font-size:12px;font-weight:700;margin-bottom:16px">✓ PAGADO</div>
    <h2 style="color:#0d1829;margin:0 0 16px">Voucher — ${r.destino}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Pasajero</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:700">${r.pasajero_nombre}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Código</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#c9a84c">${r.codigo}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${r.tipo}${r.habitacion ? " · " + r.habitacion : ""}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Fecha</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${fmtD(r.fecha_in)}${r.fecha_out ? " → " + fmtD(r.fecha_out) : ""}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Proveedor</td><td style="padding:8px 0">${r.proveedor_nombre || "—"}</td></tr>
    </table>
  </div>
  <div style="background:#0d1829;padding:16px;border-radius:8px;text-align:center">
    <p style="color:#7a9cc8;margin:0;font-size:12px">¿Consultas? guido@luckytourviajes.com</p>
    <p style="color:#4a6fa5;margin:4px 0 0;font-size:11px">Lucky Tour Viajes</p>
  </div>
</div>`;
}
const paxStr = (r) => { const p = []; if (r.adultos) p.push(r.adultos + "A"); if (r.chd) p.push(r.chd + "CHD"); if (r.inf) p.push(r.inf + "INF"); return p.join(" · "); };

function Badge({ estado }) {
  return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: ESTADO_BG[estado] || "#1e2a3a", color: ESTADO_C[estado] || "#94a3b8", border: "1px solid " + (ESTADO_C[estado] || "#1e3a5f") + "44" }}>{estado}</span>;
}

const S = {
  card: { background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 12, padding: 18 },
  inp: { width: "100%", background: "#080f1a", border: "1px solid #1e3a5f", borderRadius: 7, padding: "8px 11px", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" },
  sel: { background: "#080f1a", border: "1px solid #1e3a5f", borderRadius: 7, padding: "8px 11px", color: "#e2e8f0", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" },
  fg: { marginBottom: 14 },
  fl: { display: "block", fontSize: 11, color: "#7a9cc8", marginBottom: 5, fontWeight: 500 },
  th: { padding: "9px 13px", textAlign: "left", fontSize: 10, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #1e3a5f", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "11px 13px", fontSize: 12, borderBottom: "1px solid #0a1628", verticalAlign: "middle" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,.87)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "24px 16px", overflowY: "auto" },
  pt: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 },
  ps: { fontSize: 12, color: "#4a6fa5", marginBottom: 20 },
  stitle: { fontSize: 10, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #1e3a5f" },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  err: { fontSize: 11, color: "#ef4444", marginTop: 4 },
  sec: { background: "#080f1a", borderRadius: 8, padding: "14px 16px", marginBottom: 16 },
};

function mbox(maxW) { return { background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 14, width: "100%", maxWidth: maxW || 700, padding: 26 }; }

function btnS(v, s) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", borderRadius: 7, fontWeight: 600, fontSize: s === "sm" ? 11 : 12, padding: s === "sm" ? "5px 10px" : "9px 16px" };
  const variants = { pri: { background: "#c9a84c", color: "#0d1829" }, success: { background: "#10b981", color: "#fff" }, blue: { background: "#3b82f6", color: "#fff" }, danger: { background: "#dc2626", color: "#fff" }, secondary: { background: "#1e3a5f", color: "#e2e8f0" }, ghost: { background: "transparent", color: "#7a9cc8", border: "1px solid #1e3a5f" } };
  return { ...base, ...(variants[v] || variants.secondary) };
}

function Stat({ label, value, color, sub }) {
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "#c9a84c" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a6fa5", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Tabla({ cols, rows, empty }) {
  return (
    <div style={{ ...S.card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{cols.map((c, i) => <th key={i} style={S.th}>{typeof c === "string" ? c : c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ ...S.td, textAlign: "center", color: "#4a6fa5", padding: 40 }}>{empty || "Sin resultados"}</td></tr>
            : rows}
        </tbody>
      </table>
    </div>
  );
}

function Spinner() { return <div style={{ textAlign: "center", padding: 60, color: "#4a6fa5", fontSize: 13 }}>Cargando...</div>; }

function generarAlertas(reservas) {
  const alertas = [];
  (reservas || []).forEach(function(r) {
    var dViaje = diasHasta(r.fecha_in);
    var dPago = diasHasta(r.vto_pago);
    var dCobro = diasHasta(r.vto_cobro);
    var dReserva = diasHasta(r.vto_reserva);
    var esAereo = r.tipo === "Aéreo";
    if (["Cerrada", "Cancelada"].includes(r.estado)) return;
    // Vto pago al proveedor — todos
    if (dPago !== null && dPago <= 5 && dPago >= 0 && r.estado !== "Pagada")
      alertas.push({ id: "pago_" + r.id, tipo: "vencimiento_pago", msg: "Vence pago — " + (r.proveedor_nombre || ""), sub: r.pasajero_nombre + " · " + r.codigo, dias: dPago, urgente: dPago <= 2 });
    // Vto cobro al cliente — todos
    if (dCobro !== null && dCobro <= 5 && dCobro >= 0 && r.estado !== "Pagada")
      alertas.push({ id: "cobro_" + r.id, tipo: "vencimiento_cobro", msg: "Vence cobro al cliente", sub: r.pasajero_nombre + " · " + r.codigo, dias: dCobro, urgente: dCobro <= 2 });
    // Vto reserva — solo NO aéreos
    if (!esAereo && dReserva !== null && dReserva <= 3 && dReserva >= 0)
      alertas.push({ id: "res_" + r.id, tipo: "vencimiento_reserva", msg: "Vence reserva en " + (dReserva === 0 ? "hoy" : dReserva + "d"), sub: r.pasajero_nombre + " · " + r.codigo, dias: dReserva, urgente: dReserva <= 1 });
    // Viaje próximo — todos
    if (dViaje !== null && dViaje <= 7 && dViaje >= 0)
      alertas.push({ id: "viaje_" + r.id, tipo: "viaje_proximo", msg: "Viaje en " + (dViaje === 0 ? "HOY" : dViaje + " días") + " — " + r.destino, sub: r.pasajero_nombre + " · " + r.codigo, dias: dViaje, urgente: dViaje <= 2 });
    // Sin seguro
    if (!r.seguro_compania && dViaje !== null && dViaje <= 30)
      alertas.push({ id: "seg_" + r.id, tipo: "sin_seguro", msg: "Sin seguro de viaje", sub: r.pasajero_nombre + " — " + r.destino, dias: dViaje, urgente: dViaje !== null && dViaje <= 7 });
  });
  return alertas.sort(function(a, b) { return (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0); });
}

// ══ LOGIN ══
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function intentar() {
    if (!email || !pass) { setErr("Completá los campos"); return; }
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) { setErr("Email o contraseña incorrectos"); setLoading(false); return; }
    const { data: perfil } = await supabase.from("usuarios").select("*").eq("id", data.user.id).single();
    onLogin(perfil || { id: data.user.id, nombre: email.split("@")[0], email, rol: "vendedor", iniciales: email.slice(0, 2).toUpperCase(), color: "#3b82f6" });
    setLoading(false);
  }
  return (
    <div style={{ minHeight: "100vh", background: "#080f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: 380, padding: 40, background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#c9a84c", letterSpacing: 3, textTransform: "uppercase" }}>LUCKY TOUR</div>
          <div style={{ fontSize: 11, color: "#4a6fa5", letterSpacing: 3, marginTop: 4, textTransform: "uppercase" }}>Sistema de gestión</div>
        </div>
        <div style={S.fg}><label style={S.fl}>Email</label><input style={S.inp} value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && intentar()} placeholder="tu@luckytourviajes.com" autoComplete="email" /></div>
        <div style={S.fg}><label style={S.fl}>Contraseña</label><input style={S.inp} type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && intentar()} placeholder="••••••••" autoComplete="current-password" /></div>
        {err && <div style={S.err}>{err}</div>}
        <button style={{ ...btnS("pri"), width: "100%", justifyContent: "center", padding: "12px", marginTop: 14, opacity: loading ? 0.7 : 1 }} onClick={intentar} disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
      </div>
    </div>
  );
}

// ══ SIDEBAR ══
const NAV = [
  { id: "dashboard", icon: "◉", label: "Dashboard" },
  { id: "expedientes", icon: "📁", label: "Expedientes" },
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
        <button style={{ ...btnS("ghost", "sm"), padding: "4px 7px", fontSize: 14 }} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "▶" : "◀"}</button>
      </div>
      <div style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: collapsed ? "12px 0" : "11px 16px", justifyContent: collapsed ? "center" : "flex-start", border: "none", background: active ? "#1e3a5f" : "transparent", color: active ? "#c9a84c" : "#4a6fa5", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent", position: "relative" }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
              {item.id === "alertas" && alertasCount > 0 && <span style={{ position: collapsed ? "absolute" : "static", top: 8, right: 8, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{alertasCount}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: collapsed ? "12px 0" : "12px 16px", borderTop: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1e3a5f", border: "2px solid " + (user?.color || "#c9a84c"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: user?.color || "#c9a84c", flexShrink: 0 }}>{user?.iniciales || "?"}</div>
        {!collapsed && (<><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user?.nombre || "").split(" ")[0]}</div><div style={{ fontSize: 9, color: "#4a6fa5", textTransform: "uppercase" }}>{user?.rol}</div></div><button style={{ ...btnS("ghost", "sm"), padding: "3px 7px", fontSize: 10 }} onClick={onLogout}>Salir</button></>)}
      </div>
    </div>
  );
}

// ══ MODAL RESERVA ══
const FORM_EMPTY = { codigo: "", estado: "Borrador", tipo: "Aéreo", destino: "", pasajero_nombre: "", pasajero_mail: "", pasajero_tel: "", cliente_id: null, fecha_in: "", fecha_out: "", vto_pago: "", vto_cobro: "", vto_reserva: "", proveedor_id: "", proveedor_nombre: "", cuenta_proveedor_id: "", habitacion: "", adultos: 1, chd: 0, inf: 0, moneda: "USD", neto: "", venta: "", seguro_compania: "", seguro_poliza: "", seguro_desde: "", seguro_hasta: "", vendedor: "", notas: "" };

function ModalReserva({ reserva, proveedores, clientes, user, onSave, onClose }) {
  const esNueva = !reserva;
  const [f, setF] = useState(reserva ? { ...FORM_EMPTY, ...reserva, proveedor_id: String(reserva.proveedor_id || ""), neto: reserva.neto || "", venta: reserva.venta || "" } : { ...FORM_EMPTY, vendedor: user?.nombre || "" });
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState({});
  const [busqCliente, setBusqCliente] = useState(reserva ? reserva.pasajero_nombre || "" : "");
  const [mostrarBusq, setMostrarBusq] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const provSel = proveedores.find(p => String(p.id) === String(f.proveedor_id));
  const cuentasSel = provSel?.cuentas_proveedor || [];
  const ganancia = f.venta && f.neto ? (parseFloat(f.venta) - parseFloat(f.neto)) : 0;
  const nn = noches(f.fecha_in, f.fecha_out);
  const clientesFiltrados = clientes.filter(c => { const s = busqCliente.toLowerCase(); return s.length >= 2 && ((c.nombre + " " + c.apellido).toLowerCase().includes(s) || (c.dni || "").includes(s)); }).slice(0, 6);

  function selCliente(c) { setF(x => ({ ...x, cliente_id: c.id, pasajero_nombre: c.nombre + " " + c.apellido, pasajero_mail: c.mail || "", pasajero_tel: c.tel || "" })); setBusqCliente(c.nombre + " " + c.apellido); setMostrarBusq(false); }

  function validar() {
    const e = {};
    if (!f.destino) e.destino = "Requerido";
    if (!f.pasajero_nombre) e.pasajero_nombre = "Requerido";
    if (!f.fecha_in) e.fecha_in = "Requerido";
    if (!f.proveedor_id) e.proveedor_id = "Requerido";
    if (!f.venta) e.venta = "Requerido";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setSaving(true);
    let codigo = f.codigo;
    if (!codigo) {
      const { count } = await supabase.from("reservas").select("*", { count: "exact", head: true });
      codigo = "LT-" + new Date().getFullYear() + "-" + String((count || 0) + 1).padStart(3, "0");
    }
    const neto = f.neto ? parseFloat(f.neto) : null;
    const netoAnterior = reserva?.neto ? parseFloat(reserva.neto) : null;
    const netoChanged = neto !== netoAnterior;
    const payload = {
      codigo, estado: f.estado, tipo: f.tipo, destino: f.destino,
      cliente_id: f.cliente_id || null, pasajero_nombre: f.pasajero_nombre,
      pasajero_mail: f.pasajero_mail, pasajero_tel: f.pasajero_tel,
      fecha_in: f.fecha_in || null, fecha_out: f.fecha_out || null,
      vto_pago: f.vto_pago || null, vto_cobro: f.vto_cobro || null, vto_reserva: f.vto_reserva || null,
      proveedor_id: f.proveedor_id ? parseInt(f.proveedor_id) : null,
      proveedor_nombre: provSel?.nombre || f.proveedor_nombre || "",
      cuenta_proveedor_id: f.cuenta_proveedor_id || null,
      habitacion: f.habitacion, adultos: parseInt(f.adultos) || 1,
      chd: parseInt(f.chd) || 0, inf: parseInt(f.inf) || 0,
      moneda: f.moneda, neto, venta: f.venta ? parseFloat(f.venta) : null,
      seguro_compania: f.seguro_compania, seguro_poliza: f.seguro_poliza,
      seguro_desde: f.seguro_desde || null, seguro_hasta: f.seguro_hasta || null,
      vendedor: f.vendedor, vendedor_id: user?.id || null, notas: f.notas,
      created_by: user?.id || null,
    };

    let error, data;
    if (esNueva) {
      // saldo_pendiente = neto al crear
      payload.saldo_pendiente = neto || 0;
      ({ error, data } = await supabase.from("reservas").insert([payload]).select().single());
      // Registrar deuda automática en movimientos
      if (!error && neto && f.proveedor_id) {
        await supabase.from("movimientos").insert([{
          tipo: "deuda_proveedor",
          fecha: hoy(),
          monto_origen: neto,
          moneda_origen: f.moneda,
          proveedor_id: parseInt(f.proveedor_id),
          cuenta_proveedor_id: f.cuenta_proveedor_id || null,
          concepto: "Deuda generada — " + codigo + " · " + f.pasajero_nombre,
          reserva_cod: codigo,
          usuario_id: user?.id || null,
        }]);
        // Actualizar saldo del proveedor (restar neto)
        if (f.cuenta_proveedor_id) {
          const { data: cp } = await supabase.from("cuentas_proveedor").select("saldo").eq("id", f.cuenta_proveedor_id).single();
          if (cp) await supabase.from("cuentas_proveedor").update({ saldo: (cp.saldo || 0) - neto }).eq("id", f.cuenta_proveedor_id);
        }
      }
    } else {
      // Si cambió el neto, ajustar saldo_pendiente
      if (netoChanged && neto !== null) {
        const pagado = (netoAnterior || 0) - (reserva.saldo_pendiente || 0);
        payload.saldo_pendiente = Math.max(0, neto - pagado);
      }
      ({ error } = await supabase.from("reservas").update(payload).eq("id", reserva.id));
    }

    setSaving(false);
    if (error) { alert("Error al guardar: " + error.message); return; }
    onSave();
  }

  const TABS = ["📋 General", "💰 Financiero", "🛡️ Seguro", "📝 Notas"];
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={mbox(740)} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>{esNueva ? "Nueva reserva" : "Editar — " + f.codigo}</div>{!esNueva && <div style={{ fontSize: 11, color: "#4a6fa5", marginTop: 2 }}>{f.pasajero_nombre} · {f.destino}</div>}</div>
          <button style={btnS("ghost", "sm")} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#080f1a", borderRadius: 8, padding: 4 }}>
          {TABS.map((t, i) => <button key={i} style={{ ...btnS(tab === i ? "secondary" : "ghost", "sm"), flex: 1, justifyContent: "center" }} onClick={() => setTab(i)}>{t}</button>)}
        </div>

        {tab === 0 && (
          <div>
            <div style={S.sec}>
              <div style={S.stitle}>Pasajero</div>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <label style={S.fl}>Buscar pasajero existente</label>
                <input style={S.inp} value={busqCliente} onChange={e => { setBusqCliente(e.target.value); setMostrarBusq(true); }} placeholder="Nombre, apellido o DNI..." onFocus={() => setMostrarBusq(true)} onBlur={() => setTimeout(() => setMostrarBusq(false), 200)} />
                {mostrarBusq && clientesFiltrados.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                    {clientesFiltrados.map(c => <div key={c.id} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e3a5f", fontSize: 12 }} onMouseDown={() => selCliente(c)}><strong>{c.nombre} {c.apellido}</strong> <span style={{ color: "#4a6fa5" }}>· DNI {c.dni}</span></div>)}
                  </div>
                )}
              </div>
              <div style={S.g2}>
                <div style={S.fg}><label style={S.fl}>Nombre completo *</label><input style={{ ...S.inp, borderColor: err.pasajero_nombre ? "#ef4444" : "#1e3a5f" }} value={f.pasajero_nombre} onChange={e => set("pasajero_nombre", e.target.value)} />{err.pasajero_nombre && <div style={S.err}>{err.pasajero_nombre}</div>}</div>
                <div style={S.fg}><label style={S.fl}>Email</label><input style={S.inp} value={f.pasajero_mail} onChange={e => set("pasajero_mail", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Teléfono</label><input style={S.inp} value={f.pasajero_tel} onChange={e => set("pasajero_tel", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Vendedor</label><input style={S.inp} value={f.vendedor} onChange={e => set("vendedor", e.target.value)} /></div>
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.stitle}>Servicio</div>
              <div style={S.g2}>
                <div style={S.fg}><label style={S.fl}>Tipo</label><select style={S.sel} value={f.tipo} onChange={e => set("tipo", e.target.value)}>{TIPOS_RESERVA.map(t => <option key={t}>{t}</option>)}</select></div>
                <div style={S.fg}><label style={S.fl}>Destino *</label><input style={{ ...S.inp, borderColor: err.destino ? "#ef4444" : "#1e3a5f" }} value={f.destino} onChange={e => set("destino", e.target.value)} placeholder="Ej: Cancún, París..." />{err.destino && <div style={S.err}>{err.destino}</div>}</div>
                <div style={S.fg}><label style={S.fl}>Estado</label><select style={S.sel} value={f.estado} onChange={e => set("estado", e.target.value)}>{ESTADOS_RESERVA.map(e => <option key={e}>{e}</option>)}</select></div>
                <div style={S.fg}><label style={S.fl}>Descripción del servicio</label><input style={S.inp} value={f.habitacion} onChange={e => set("habitacion", e.target.value)} placeholder="Ej: Suite + desayuno, AA1234 EZE→MIA..." /></div>
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.stitle}>Proveedor</div>
              <div style={S.g2}>
                <div style={S.fg}><label style={S.fl}>Proveedor *</label><select style={{ ...S.sel, borderColor: err.proveedor_id ? "#ef4444" : "#1e3a5f" }} value={f.proveedor_id} onChange={e => { set("proveedor_id", e.target.value); set("cuenta_proveedor_id", ""); }}><option value="">Seleccionar...</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>{err.proveedor_id && <div style={S.err}>{err.proveedor_id}</div>}</div>
                <div style={S.fg}><label style={S.fl}>Cuenta</label><select style={S.sel} value={f.cuenta_proveedor_id} onChange={e => set("cuenta_proveedor_id", e.target.value)} disabled={!cuentasSel.length}><option value="">Seleccionar...</option>{cuentasSel.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}</select></div>
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.stitle}>Fechas y PAX</div>
              <div style={S.g2}>
                <div style={S.fg}><label style={S.fl}>Check In *</label><input style={{ ...S.inp, borderColor: err.fecha_in ? "#ef4444" : "#1e3a5f" }} type="date" value={f.fecha_in} onChange={e => set("fecha_in", e.target.value)} />{err.fecha_in && <div style={S.err}>{err.fecha_in}</div>}</div>
                <div style={S.fg}><label style={S.fl}>Check Out</label><input style={S.inp} type="date" value={f.fecha_out} onChange={e => set("fecha_out", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Vencimiento cobro (al cliente)</label><input style={S.inp} type="date" value={f.vto_cobro} onChange={e => set("vto_cobro", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Vencimiento pago (al proveedor)</label><input style={S.inp} type="date" value={f.vto_pago} onChange={e => set("vto_pago", e.target.value)} /></div>
                {f.tipo !== "Aéreo" && <div style={S.fg}><label style={S.fl}>Vencimiento reserva</label><input style={S.inp} type="date" value={f.vto_reserva} onChange={e => set("vto_reserva", e.target.value)} /></div>}
                {f.tipo === "Aéreo" && <div></div>}
              </div>
              <div style={S.g3}>
                <div style={S.fg}><label style={S.fl}>Adultos</label><input style={S.inp} type="number" min="1" value={f.adultos} onChange={e => set("adultos", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Menores (CHD)</label><input style={S.inp} type="number" min="0" value={f.chd} onChange={e => set("chd", e.target.value)} /></div>
                <div style={S.fg}><label style={S.fl}>Bebés (INF)</label><input style={S.inp} type="number" min="0" value={f.inf} onChange={e => set("inf", e.target.value)} /></div>
              </div>
              {f.fecha_in && f.fecha_out && <div style={{ fontSize: 11, color: "#c9a84c" }}>📅 {nn} noche{nn !== 1 ? "s" : ""}</div>}
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={S.sec}>
            <div style={S.stitle}>Precios</div>
            <div style={S.g2}>
              <div style={S.fg}><label style={S.fl}>Moneda</label><select style={S.sel} value={f.moneda} onChange={e => set("moneda", e.target.value)}><option>USD</option><option>ARS</option><option>EUR</option></select></div>
              <div></div>
              <div style={S.fg}><label style={S.fl}>Neto (costo al proveedor)</label><input style={S.inp} type="number" value={f.neto} onChange={e => set("neto", e.target.value)} placeholder="0.00" /></div>
              <div style={S.fg}><label style={S.fl}>Venta (precio al cliente) *</label><input style={{ ...S.inp, borderColor: err.venta ? "#ef4444" : "#1e3a5f" }} type="number" value={f.venta} onChange={e => set("venta", e.target.value)} placeholder="0.00" />{err.venta && <div style={S.err}>{err.venta}</div>}</div>
            </div>
            {ganancia > 0 && <div style={{ padding: "10px 14px", background: "#0a2d1e", borderRadius: 8 }}><span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>💚 Ganancia: {fmt(ganancia, f.moneda)}</span></div>}
          </div>
        )}

        {tab === 2 && (
          <div style={S.sec}>
            <div style={S.stitle}>Seguro de viaje</div>
            <div style={S.g2}>
              <div style={S.fg}><label style={S.fl}>Compañía</label><input style={S.inp} value={f.seguro_compania} onChange={e => set("seguro_compania", e.target.value)} placeholder="Ej: Assist Card, Universal..." /></div>
              <div style={S.fg}><label style={S.fl}>Nro de póliza</label><input style={S.inp} value={f.seguro_poliza} onChange={e => set("seguro_poliza", e.target.value)} /></div>
              <div style={S.fg}><label style={S.fl}>Vigencia desde</label><input style={S.inp} type="date" value={f.seguro_desde} onChange={e => set("seguro_desde", e.target.value)} /></div>
              <div style={S.fg}><label style={S.fl}>Vigencia hasta</label><input style={S.inp} type="date" value={f.seguro_hasta} onChange={e => set("seguro_hasta", e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 3 && (
          <div style={S.sec}>
            <div style={S.stitle}>Observaciones</div>
            <textarea style={{ ...S.inp, minHeight: 140, resize: "vertical" }} value={f.notas} onChange={e => set("notas", e.target.value)} placeholder="Notas internas, condiciones especiales, requerimientos del pasajero..." />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e3a5f" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {tab > 0 && <button style={btnS("ghost")} onClick={() => setTab(t => t - 1)}>← Anterior</button>}
            {tab < 3 && <button style={btnS("secondary")} onClick={() => setTab(t => t + 1)}>Siguiente →</button>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnS("ghost")} onClick={onClose}>Cancelar</button>
            <button style={{ ...btnS("pri"), opacity: saving ? 0.7 : 1 }} onClick={guardar} disabled={saving}>{saving ? "Guardando..." : esNueva ? "✓ Crear reserva" : "✓ Guardar cambios"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══ MODAL CLIENTE ══
const CLI_EMPTY = { nombre: "", apellido: "", dni: "", pasaporte: "", pasaporte_vto: "", tel: "", mail: "", fecha_nac: "", notas: "" };
function ModalCliente({ cliente, onSave, onClose }) {
  const esNuevo = !cliente;
  const [f, setF] = useState(cliente || CLI_EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState({});
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  async function guardar() {
    const e = {};
    if (!f.nombre) e.nombre = "Requerido";
    if (!f.apellido) e.apellido = "Requerido";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = { nombre: f.nombre, apellido: f.apellido, dni: f.dni, pasaporte: f.pasaporte, pasaporte_vto: f.pasaporte_vto || null, tel: f.tel, mail: f.mail, fecha_nac: f.fecha_nac || null, notas: f.notas };
    let error;
    if (esNuevo) { ({ error } = await supabase.from("clientes").insert([payload])); }
    else { ({ error } = await supabase.from("clientes").update(payload).eq("id", cliente.id)); }
    setSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    onSave();
  }
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={mbox(600)} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{esNuevo ? "Nuevo cliente" : "Editar — " + f.nombre + " " + f.apellido}</div>
          <button style={btnS("ghost", "sm")} onClick={onClose}>✕</button>
        </div>
        <div style={S.g2}>
          <div style={S.fg}><label style={S.fl}>Nombre *</label><input style={{ ...S.inp, borderColor: err.nombre ? "#ef4444" : "#1e3a5f" }} value={f.nombre} onChange={e => set("nombre", e.target.value)} />{err.nombre && <div style={S.err}>{err.nombre}</div>}</div>
          <div style={S.fg}><label style={S.fl}>Apellido *</label><input style={{ ...S.inp, borderColor: err.apellido ? "#ef4444" : "#1e3a5f" }} value={f.apellido} onChange={e => set("apellido", e.target.value)} />{err.apellido && <div style={S.err}>{err.apellido}</div>}</div>
          <div style={S.fg}><label style={S.fl}>DNI</label><input style={S.inp} value={f.dni} onChange={e => set("dni", e.target.value)} /></div>
          <div style={S.fg}><label style={S.fl}>Fecha de nacimiento</label><input style={S.inp} type="date" value={f.fecha_nac} onChange={e => set("fecha_nac", e.target.value)} /></div>
          <div style={S.fg}><label style={S.fl}>Pasaporte</label><input style={S.inp} value={f.pasaporte} onChange={e => set("pasaporte", e.target.value)} /></div>
          <div style={S.fg}><label style={S.fl}>Vencimiento pasaporte</label><input style={S.inp} type="date" value={f.pasaporte_vto} onChange={e => set("pasaporte_vto", e.target.value)} /></div>
          <div style={S.fg}><label style={S.fl}>Teléfono</label><input style={S.inp} value={f.tel} onChange={e => set("tel", e.target.value)} /></div>
          <div style={S.fg}><label style={S.fl}>Email</label><input style={S.inp} value={f.mail} onChange={e => set("mail", e.target.value)} /></div>
        </div>
        <div style={S.fg}><label style={S.fl}>Notas</label><textarea style={{ ...S.inp, minHeight: 70, resize: "vertical" }} value={f.notas} onChange={e => set("notas", e.target.value)} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnS("ghost")} onClick={onClose}>Cancelar</button>
          <button style={{ ...btnS("pri"), opacity: saving ? 0.7 : 1 }} onClick={guardar} disabled={saving}>{saving ? "Guardando..." : esNuevo ? "✓ Crear cliente" : "✓ Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ══ DASHBOARD ══
function Dashboard({ reservas, movimientos, alertas, setPage }) {
  const activas = reservas.filter(r => !["Cerrada", "Cancelada"].includes(r.estado)).length;
  const proximas = reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).length;
  const urgentes = alertas.filter(a => a.urgente).length;
  const margen = reservas.filter(r => r.estado !== "Cancelada" && r.moneda === "USD").reduce((s, r) => s + ((r.venta || 0) - (r.neto || 0)), 0);
  return (
    <div>
      <div style={S.pt}>Dashboard</div>
      <div style={{ ...S.ps, marginBottom: 24 }}>Bienvenido · {fmtD(hoy())}</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Reservas activas" value={activas} />
        <Stat label="Viajes próximos 30d" value={proximas} color="#3b82f6" />
        <Stat label="Alertas urgentes" value={urgentes} color={urgentes > 0 ? "#ef4444" : "#10b981"} />
        <Stat label="Margen USD" value={fmt(margen, "USD")} color="#10b981" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={S.stitle}>🚨 Alertas urgentes</div>
          {alertas.filter(a => a.urgente).slice(0, 5).map(a => <div key={a.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040" }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{a.msg}</div><div style={{ fontSize: 10, color: "#7a9cc8" }}>{a.sub}</div></div>{a.dias !== null && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>{a.dias === 0 ? "HOY" : a.dias + "d"}</span>}</div>)}
          {alertas.filter(a => a.urgente).length === 0 && <div style={{ fontSize: 12, color: "#10b981" }}>✅ Sin urgencias</div>}
          <button style={{ ...btnS("ghost", "sm"), marginTop: 12 }} onClick={() => setPage("alertas")}>Ver todas →</button>
        </div>
        <div style={S.card}>
          <div style={S.stitle}>✈️ Próximos viajes</div>
          {reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).sort((a, b) => (a.fecha_in || "").localeCompare(b.fecha_in || "")).slice(0, 5).map(r => { const d = diasHasta(r.fecha_in); return <div key={r.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{(r.pasajero_nombre || "").split(" ")[0]} — {r.destino}</div><div style={{ fontSize: 10, color: "#7a9cc8" }}>{fmtD(r.fecha_in)} · {r.codigo}</div></div><span style={{ fontSize: 11, fontWeight: 700, color: d <= 3 ? "#ef4444" : d <= 7 ? "#f59e0b" : "#3b82f6" }}>{d === 0 ? "HOY" : d + "d"}</span></div>; })}
          {reservas.filter(r => { const d = diasHasta(r.fecha_in); return d !== null && d <= 30 && d >= 0; }).length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>Sin viajes en 30 días</div>}
        </div>
        <div style={S.card}>
          <div style={S.stitle}>💳 Vencimientos de pago</div>
          {reservas.filter(r => { const d = diasHasta(r.vto_pago); return d !== null && d <= 14 && d >= 0 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado); }).sort((a, b) => (a.vto_pago || "").localeCompare(b.vto_pago || "")).map(r => { const d = diasHasta(r.vto_pago); return <div key={r.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{r.proveedor_nombre}</div><div style={{ fontSize: 10, color: "#7a9cc8" }}>{(r.pasajero_nombre || "").split(" ")[0]} · {fmt(r.neto, r.moneda)}</div></div><span style={{ fontSize: 11, fontWeight: 700, color: d <= 2 ? "#ef4444" : "#f59e0b" }}>{d === 0 ? "HOY" : d + "d"}</span></div>; })}
          {reservas.filter(r => { const d = diasHasta(r.vto_pago); return d !== null && d <= 14 && d >= 0 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado); }).length === 0 && <div style={{ fontSize: 12, color: "#10b981" }}>✅ Sin pagos urgentes</div>}
        </div>
        <div style={S.card}>
          <div style={S.stitle}>🔄 Últimos movimientos</div>
          {[...movimientos].slice(0, 5).map(m => { const esCobro = m.tipo === "cobro_cliente" || m.tipo === "ingreso"; return <div key={m.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #0f2040", alignItems: "center" }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{fmtD(m.fecha)}</div></div><span style={{ fontSize: 12, fontWeight: 700, color: esCobro ? "#10b981" : "#ef4444" }}>{esCobro ? "+" : "-"}{fmt(m.monto_origen, m.moneda_origen)}</span></div>; })}
          {movimientos.length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>Sin movimientos</div>}
          <button style={{ ...btnS("ghost", "sm"), marginTop: 12 }} onClick={() => setPage("finanzas")}>Ver finanzas →</button>
        </div>
      </div>
    </div>
  );
}

// ══ MODAL CANCELACION ══
function ModalCancelacion({ reserva, onConfirmar, onClose }) {
  const [penProv, setPenProv] = useState("");
  const [penCli, setPenCli] = useState("");
  const [notas, setNotas] = useState("");
  const [cobradoCli, setCobradoCli] = useState(null);
  const [loadingCobros, setLoadingCobros] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Buscar cobros al cliente para esta reserva
    supabase.from("movimientos")
      .select("monto_origen,moneda_origen,tc")
      .eq("reserva_cod", reserva.codigo)
      .eq("tipo", "cobro_cliente")
      .then(({ data }) => {
        const total = (data || []).reduce((s, m) => {
          // Convertir a moneda de la reserva si es necesario
          if (m.moneda_origen === reserva.moneda) return s + (m.monto_origen || 0);
          if (m.moneda_origen === "ARS" && reserva.moneda === "USD") return s + (m.monto_origen || 0) / (m.tc || 1);
          if (m.moneda_origen === "USD" && reserva.moneda === "ARS") return s + (m.monto_origen || 0) * (m.tc || 1);
          return s + (m.monto_origen || 0);
        }, 0);
        setCobradoCli(total);
        setLoadingCobros(false);
      });
  }, [reserva]);

  const penProvN = parseFloat(penProv) || 0;
  const penCliN = parseFloat(penCli) || 0;
  const cobrado = cobradoCli || 0;
  const diferencia = cobrado - penCliN; // + = reembolsar, - = cobrar

  async function confirmar() {
    setSaving(true);
    await onConfirmar({
      penalidad_proveedor: penProvN,
      penalidad_cliente: penCliN,
      cobrado_cliente: cobrado,
      notas,
    });
    setSaving(false);
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={mbox(500)} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>❌ Cancelar reserva</div>
        <div style={{ fontSize: 12, color: "#7a9cc8", marginBottom: 20 }}>
          <span style={{ fontFamily: "monospace", color: "#c9a84c" }}>{reserva.codigo}</span> — {reserva.pasajero_nombre} · {reserva.destino}
        </div>

        {/* Info de la reserva */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          <div style={{ padding: "10px 12px", background: "#080f1a", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 3 }}>Neto (proveedor)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{fmt(reserva.neto, reserva.moneda)}</div>
          </div>
          <div style={{ padding: "10px 12px", background: "#080f1a", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 3 }}>Venta (cliente)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c" }}>{fmt(reserva.venta, reserva.moneda)}</div>
          </div>
          <div style={{ padding: "10px 12px", background: "#080f1a", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 3 }}>Cobrado al cliente</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{loadingCobros ? "..." : fmt(cobrado, reserva.moneda)}</div>
          </div>
        </div>

        <div style={S.g2}>
          <div style={S.fg}>
            <label style={S.fl}>Penalidad del proveedor ({reserva.moneda})</label>
            <input style={S.inp} type="number" value={penProv} onChange={e => setPenProv(e.target.value)} placeholder="0" />
            <div style={{ fontSize: 10, color: "#4a6fa5", marginTop: 3 }}>Lo que te cobra {reserva.proveedor_nombre}</div>
          </div>
          <div style={S.fg}>
            <label style={S.fl}>Penalidad al cliente ({reserva.moneda})</label>
            <input style={S.inp} type="number" value={penCli} onChange={e => setPenCli(e.target.value)} placeholder="0" />
            <div style={{ fontSize: 10, color: "#4a6fa5", marginTop: 3 }}>Lo que le cobrás vos al cliente</div>
          </div>
        </div>

        {/* Resultado */}
        {!loadingCobros && (
          <div style={{ padding: "12px 14px", background: diferencia > 0 ? "#0a2040" : diferencia < 0 ? "#2d0f0f" : "#0a2d1e", border: "1px solid " + (diferencia > 0 ? "#3b82f644" : diferencia < 0 ? "#ef444444" : "#10b98144"), borderRadius: 8, marginBottom: 16 }}>
            {diferencia > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>💸 A reembolsar al cliente: {fmt(diferencia, reserva.moneda)}</div>}
            {diferencia < 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>💰 A cobrar al cliente: {fmt(Math.abs(diferencia), reserva.moneda)}</div>}
            {diferencia === 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>✅ Sin diferencias — queda saldado</div>}
            <div style={{ fontSize: 10, color: "#4a6fa5", marginTop: 4 }}>
              Cobrado {fmt(cobrado, reserva.moneda)} − Penalidad cliente {fmt(penCliN, reserva.moneda)}
            </div>
          </div>
        )}

        <div style={S.fg}>
          <label style={S.fl}>Notas de cancelación</label>
          <textarea style={{ ...S.inp, minHeight: 70, resize: "vertical" }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Motivo, acuerdos, observaciones..." />
        </div>

        <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 16 }}>
          ⚠️ La reserva queda guardada como Cancelada. La deuda pendiente con el proveedor se revierte automáticamente.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnS("ghost")} onClick={onClose}>Volver</button>
          <button style={{ ...btnS("danger"), opacity: saving ? 0.7 : 1 }} onClick={confirmar} disabled={saving}>
            {saving ? "Procesando..." : "❌ Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══ RESERVAS ══
function Reservas({ proveedores, clientes, user }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modal, setModal] = useState(null);
  const cargar = useCallback(async () => { setLoading(true); const { data } = await supabase.from("reservas").select("*").order("created_at", { ascending: false }); setReservas(data || []); setLoading(false); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const lista = reservas.filter(r => { const s = q.toLowerCase(); return (!q || (r.pasajero_nombre || "").toLowerCase().includes(s) || (r.codigo || "").toLowerCase().includes(s) || (r.destino || "").toLowerCase().includes(s) || (r.proveedor_nombre || "").toLowerCase().includes(s)) && (!filtroEstado || r.estado === filtroEstado); });
  const [confirmCancel, setConfirmCancel] = useState(null); // reserva a cancelar

  async function cambiarEstado(r, nuevoEstado) {
    if (nuevoEstado === "Cancelada" && r.estado !== "Cancelada" && (r.saldo_pendiente || 0) > 0) {
      setConfirmCancel({ r, nuevoEstado });
      return;
    }
    await ejecutarCambioEstado(r, nuevoEstado, false);
  }

  async function ejecutarCambioEstado(r, nuevoEstado, datosCancelacion) {
    const upd = { estado: nuevoEstado };
    if (nuevoEstado === "Cancelada") {
      upd.saldo_pendiente = 0;
      if (datosCancelacion) {
        upd.cancel_penalidad_proveedor = datosCancelacion.penalidad_proveedor || 0;
        upd.cancel_penalidad_cliente = datosCancelacion.penalidad_cliente || 0;
        upd.cancel_notas = datosCancelacion.notas || "";
      }
    }
    await supabase.from("reservas").update(upd).eq("id", r.id);

    if (nuevoEstado === "Cancelada" && datosCancelacion) {
      const { penalidad_proveedor, penalidad_cliente, cobrado_cliente } = datosCancelacion;
      // Revertir deuda pendiente con proveedor (lo que quedaba sin pagar)
      if (r.cuenta_proveedor_id && (r.saldo_pendiente || 0) > 0) {
        const { data: cp } = await supabase.from("cuentas_proveedor").select("saldo").eq("id", r.cuenta_proveedor_id).single();
        if (cp) {
          // Revertir saldo pendiente y aplicar penalidad del proveedor
          const ajuste = (r.saldo_pendiente || 0) - (penalidad_proveedor || 0);
          await supabase.from("cuentas_proveedor").update({ saldo: (cp.saldo || 0) + ajuste }).eq("id", r.cuenta_proveedor_id);
        }
      }
      // Registrar movimiento de cancelación
      const diferencia = (cobrado_cliente || 0) - (penalidad_cliente || 0);
      const conceptoCan = "Cancelación " + r.codigo + " · " + r.pasajero_nombre +
        (penalidad_proveedor ? " | Penalidad prov: " + fmt(penalidad_proveedor, r.moneda) : "") +
        (penalidad_cliente ? " | Penalidad cli: " + fmt(penalidad_cliente, r.moneda) : "") +
        (diferencia > 0 ? " | A REEMBOLSAR: " + fmt(diferencia, r.moneda) : diferencia < 0 ? " | A COBRAR: " + fmt(Math.abs(diferencia), r.moneda) : "");
      await supabase.from("movimientos").insert([{
        tipo: "cancelacion", fecha: hoy(),
        monto_origen: penalidad_proveedor || 0,
        moneda_origen: r.moneda,
        proveedor_id: r.proveedor_id || null,
        cuenta_proveedor_id: r.cuenta_proveedor_id || null,
        concepto: conceptoCan,
        reserva_cod: r.codigo,
      }]);
    }
    setConfirmCancel(null);
    cargar();
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={S.pt}>Reservas</div><div style={S.ps}>{lista.length} reservas</div></div>
        <button style={btnS("pri")} onClick={() => setModal("nueva")}>+ Nueva reserva</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input style={{ ...S.inp, maxWidth: 280 }} placeholder="Buscar pasajero, código, destino..." value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...S.sel, maxWidth: 180 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}><option value="">Todos los estados</option>{ESTADOS_RESERVA.map(e => <option key={e}>{e}</option>)}</select>
      </div>
      {loading ? <Spinner /> : (
        <Tabla
          cols={["Código", "Pasajero", "Destino", "Fechas", "Venta", "Vto pago", "Estado", ""]}
          rows={lista.map(r => {
            const dPago = diasHasta(r.vto_pago);
            const pagoUrg = dPago !== null && dPago <= 3 && !["Pagada", "Cerrada", "Cancelada"].includes(r.estado);
            const dViaje = diasHasta(r.fecha_in);
            return (
              <tr key={r.id} style={{ background: "#0d1829" }}>
                <td style={{ ...S.td, fontFamily: "monospace", color: "#c9a84c", fontSize: 11 }}>{r.codigo}</td>
                <td style={S.td}><div style={{ fontWeight: 500 }}>{r.pasajero_nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.tipo} · {paxStr(r)}</div></td>
                <td style={S.td}><div>{r.destino}{dViaje !== null && dViaje >= 0 && dViaje <= 7 && <span style={{ marginLeft: 5, fontSize: 9, background: dViaje <= 2 ? "#2d0f0f" : "#2d2010", color: dViaje <= 2 ? "#ef4444" : "#f59e0b", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>{dViaje === 0 ? "HOY" : dViaje + "d"}</span>}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.proveedor_nombre}</div></td>
                <td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(r.fecha_in)}{r.fecha_out ? " → " + fmtD(r.fecha_out) : ""}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{fmt(r.venta, r.moneda)}</td>
                <td style={S.td}><span style={{ fontSize: 11, color: pagoUrg ? "#ef4444" : "#7a9cc8", fontWeight: pagoUrg ? 700 : 400 }}>{pagoUrg ? "⚠️ " : ""}{fmtD(r.vto_pago)}</span></td>
                <td style={S.td}><Badge estado={r.estado} /></td>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button style={btnS("ghost", "sm")} onClick={() => setModal(r)}>Editar</button>
                    <select style={{ ...S.sel, width: "auto", fontSize: 10, padding: "4px 8px" }} value={r.estado} onChange={e => cambiarEstado(r, e.target.value)}>{ESTADOS_RESERVA.map(e => <option key={e}>{e}</option>)}</select>
                  </div>
                </td>
              </tr>
            );
          })}
        />
      )}
      {modal && <ModalReserva reserva={modal === "nueva" ? null : modal} proveedores={proveedores} clientes={clientes} user={user} onSave={() => { setModal(null); cargar(); }} onClose={() => setModal(null)} />}
      {confirmCancel && <ModalCancelacion reserva={confirmCancel.r} onConfirmar={(datos) => ejecutarCambioEstado(confirmCancel.r, "Cancelada", datos)} onClose={() => setConfirmCancel(null)} />}
    </div>
  );
}

// ══ CLIENTES ══
function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const cargar = useCallback(async () => { setLoading(true); const { data } = await supabase.from("clientes").select("*").order("apellido"); setClientes(data || []); setLoading(false); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const lista = clientes.filter(c => !q || (c.nombre + " " + c.apellido).toLowerCase().includes(q.toLowerCase()) || (c.dni || "").includes(q) || (c.mail || "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={S.pt}>Clientes</div><div style={S.ps}>{lista.length} pasajeros</div></div>
        <button style={btnS("pri")} onClick={() => setModal("nuevo")}>+ Nuevo cliente</button>
      </div>
      <input style={{ ...S.inp, maxWidth: 320, marginBottom: 16 }} placeholder="Buscar por nombre, DNI o email..." value={q} onChange={e => setQ(e.target.value)} />
      {loading ? <Spinner /> : (
        <Tabla
          cols={["Nombre", "Documentos", "Contacto", "Pasaporte", ""]}
          rows={lista.map(c => {
            const pasVto = diasHasta(c.pasaporte_vto);
            const pasVencido = pasVto !== null && pasVto < 0;
            const pasUrg = pasVto !== null && pasVto >= 0 && pasVto <= 90;
            return (
              <tr key={c.id}>
                <td style={S.td}><div style={{ fontWeight: 600 }}>{c.nombre} {c.apellido}</div></td>
                <td style={S.td}><div style={{ fontSize: 11 }}>🪪 {c.dni || "—"}</div><div style={{ fontSize: 11, color: "#4a6fa5" }}>📘 {c.pasaporte || "—"}</div></td>
                <td style={S.td}><div style={{ fontSize: 11 }}>{c.tel || "—"}</div><div style={{ fontSize: 11, color: "#4a6fa5" }}>{c.mail || "—"}</div></td>
                <td style={S.td}><span style={{ fontSize: 11, color: pasVencido ? "#ef4444" : pasUrg ? "#f59e0b" : "#10b981", fontWeight: 600 }}>{pasVencido ? "⚠️ Vencido" : pasUrg ? ("⚠️ " + pasVto + "d") : "✅"}{c.pasaporte_vto ? (" " + fmtD(c.pasaporte_vto)) : ""}</span></td>
                <td style={S.td}><button style={btnS("ghost", "sm")} onClick={() => setModal(c)}>Editar</button></td>
              </tr>
            );
          })}
        />
      )}
      {modal && <ModalCliente cliente={modal === "nuevo" ? null : modal} onSave={() => { setModal(null); cargar(); }} onClose={() => setModal(null)} />}
    </div>
  );
}

// ══ PROVEEDORES ══
function Proveedores({ proveedores }) {
  return (
    <div>
      <div style={S.pt}>Proveedores</div>
      <div style={S.ps}>Saldos de cuentas</div>
      {proveedores.map(p => (
        <div key={p.id} style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.nombre}</div>
          <div style={{ fontSize: 11, color: "#4a6fa5", marginBottom: 10 }}>{p.tipo}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(p.cuentas_proveedor || []).map(c => (
              <div key={c.id} style={{ padding: "10px 14px", background: "#080f1a", borderRadius: 8, minWidth: 160 }}>
                <div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 4 }}>{c.nombre}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: (c.saldo || 0) >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo || 0, c.moneda)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══ MODAL MOVIMIENTO ══
function ModalMovimiento({ proveedores, cuentasBancarias, user, onSave, onClose }) {
  const [f, setF] = useState({ tipo: "cobro_cliente", fecha: hoy(), desde_cuenta_id: "", monto_origen: "", moneda_origen: "USD", tc: "1", proveedor_id: "", cuenta_proveedor_id: "", cliente_nombre: "", concepto: "", reserva_cod: "" });
  const [saving, setSaving] = useState(false);
  const [reservasPendientes, setReservasPendientes] = useState([]);
  const [reservaSel, setReservaSel] = useState(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const provSel = proveedores.find(p => String(p.id) === String(f.proveedor_id));

  // Cargar reservas pendientes según tipo
  useEffect(() => {
    if (f.tipo === "pago_proveedor" && f.proveedor_id) {
      supabase.from("reservas")
        .select("id,codigo,pasajero_nombre,destino,moneda,neto,saldo_pendiente,fecha_in")
        .eq("proveedor_id", parseInt(f.proveedor_id))
        .not("saldo_pendiente", "is", null)
        .gt("saldo_pendiente", 0)
        .not("estado", "in", "(Cancelada,Cerrada)")
        .order("fecha_in")
        .then(({ data }) => setReservasPendientes(data || []));
    } else if (f.tipo === "cobro_cliente") {
      // Cargar reservas activas con cobro pendiente
      supabase.from("reservas")
        .select("id,codigo,pasajero_nombre,destino,moneda,neto,venta,fecha_in,estado")
        .not("estado", "in", "(Cancelada,Cerrada,Pagada)")
        .not("venta", "is", null)
        .order("fecha_in")
        .then(async ({ data: reservasList }) => {
          if (!reservasList) return setReservasPendientes([]);
          // Para cada reserva, calcular cuánto se cobró ya
          const { data: movs } = await supabase.from("movimientos")
            .select("reserva_cod,monto_origen,moneda_origen,tc")
            .eq("tipo", "cobro_cliente");
          const cobradoPorReserva = {};
          (movs || []).forEach(m => {
            if (!m.reserva_cod) return;
            cobradoPorReserva[m.reserva_cod] = (cobradoPorReserva[m.reserva_cod] || 0) + (m.monto_origen || 0);
          });
          const conPendiente = reservasList.map(r => ({
            ...r,
            cobrado: cobradoPorReserva[r.codigo] || 0,
            pendiente_cobro: Math.max(0, (r.venta || 0) - (cobradoPorReserva[r.codigo] || 0)),
          })).filter(r => r.pendiente_cobro > 0);
          setReservasPendientes(conPendiente);
        });
    } else {
      setReservasPendientes([]);
      setReservaSel(null);
    }
  }, [f.proveedor_id, f.tipo]);

  function selReserva(r) {
    setReservaSel(r);
    if (f.tipo === "pago_proveedor") {
      set("moneda_origen", r.moneda);
      set("monto_origen", String(r.saldo_pendiente));
      set("reserva_cod", r.codigo);
      set("concepto", "Pago a " + (provSel?.nombre || "") + " — " + r.codigo + " · " + r.pasajero_nombre);
    } else if (f.tipo === "cobro_cliente") {
      set("moneda_origen", r.moneda);
      set("monto_origen", String(r.pendiente_cobro));
      set("reserva_cod", r.codigo);
      set("cliente_nombre", r.pasajero_nombre);
      set("concepto", "Cobro — " + r.codigo + " · " + r.pasajero_nombre + " · " + r.destino);
    }
  }

  // Calcular monto en moneda de la reserva para mostrar al usuario
  const montoEnMonedaReserva = () => {
    if (!f.monto_origen || !reservaSel) return null;
    const monto = parseFloat(f.monto_origen);
    const tc = parseFloat(f.tc) || 1;
    if (f.moneda_origen === reservaSel.moneda) return monto;
    // Si pago en ARS y reserva en USD: divido por TC
    if (f.moneda_origen === "ARS" && reservaSel.moneda === "USD") return monto / tc;
    // Si pago en USD y reserva en ARS: multiplico por TC
    if (f.moneda_origen === "USD" && reservaSel.moneda === "ARS") return monto * tc;
    return monto / tc;
  };

  async function guardar() {
    if (!f.concepto || !f.monto_origen) { alert("Completá concepto y monto"); return; }
    setSaving(true);

    // Insertar movimiento
    const { error } = await supabase.from("movimientos").insert([{
      tipo: f.tipo, fecha: f.fecha,
      desde_cuenta_id: f.desde_cuenta_id || null,
      monto_origen: parseFloat(f.monto_origen),
      moneda_origen: f.moneda_origen,
      tc: parseFloat(f.tc) || 1,
      proveedor_id: f.proveedor_id ? parseInt(f.proveedor_id) : null,
      cuenta_proveedor_id: f.cuenta_proveedor_id || null,
      cliente_nombre: f.cliente_nombre,
      concepto: f.concepto,
      reserva_cod: f.reserva_cod,
      usuario_id: user?.id || null,
    }]);

    if (error) { setSaving(false); alert("Error: " + error.message); return; }

    // Si es pago a proveedor con reserva seleccionada
    if (f.tipo === "pago_proveedor" && reservaSel) {
      const montoDesc = montoEnMonedaReserva() || parseFloat(f.monto_origen);
      const nuevoSaldo = Math.max(0, (reservaSel.saldo_pendiente || 0) - montoDesc);
      const nuevoEstado = nuevoSaldo <= 0 ? "Pagada" : null;

      const upd = { saldo_pendiente: nuevoSaldo };
      if (nuevoEstado) upd.estado = nuevoEstado;
      await supabase.from("reservas").update(upd).eq("id", reservaSel.id);

      // Actualizar saldo cuenta proveedor
      if (f.cuenta_proveedor_id) {
        const { data: cp } = await supabase.from("cuentas_proveedor").select("saldo").eq("id", f.cuenta_proveedor_id).single();
        if (cp) await supabase.from("cuentas_proveedor").update({ saldo: (cp.saldo || 0) + montoDesc }).eq("id", f.cuenta_proveedor_id);
      }
    }

    // Actualizar saldo cuenta bancaria
    if (f.desde_cuenta_id) {
      const { data: cb } = await supabase.from("cuentas_bancarias").select("saldo").eq("id", f.desde_cuenta_id).single();
      if (cb) {
        const esCobro = f.tipo === "cobro_cliente" || f.tipo === "ingreso";
        const delta = esCobro ? parseFloat(f.monto_origen) : -parseFloat(f.monto_origen);
        await supabase.from("cuentas_bancarias").update({ saldo: (cb.saldo || 0) + delta }).eq("id", f.desde_cuenta_id);
      }
    }

    setSaving(false);
    onSave();
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={mbox(640)} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nuevo movimiento</div>
          <button style={btnS("ghost", "sm")} onClick={onClose}>✕</button>
        </div>

        <div style={S.g2}>
          <div style={S.fg}><label style={S.fl}>Tipo</label>
            <select style={S.sel} value={f.tipo} onChange={e => { set("tipo", e.target.value); setReservaSel(null); }}>
              {Object.entries(TIPOS_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={S.fg}><label style={S.fl}>Fecha</label><input style={S.inp} type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)} /></div>
        </div>

        {/* PAGO A PROVEEDOR */}
        {f.tipo === "pago_proveedor" && (
          <div>
            <div style={S.g2}>
              <div style={S.fg}><label style={S.fl}>Proveedor</label>
                <select style={S.sel} value={f.proveedor_id} onChange={e => { set("proveedor_id", e.target.value); set("cuenta_proveedor_id", ""); setReservaSel(null); }}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={S.fg}><label style={S.fl}>Cuenta proveedor</label>
                <select style={S.sel} value={f.cuenta_proveedor_id} onChange={e => set("cuenta_proveedor_id", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {(provSel?.cuentas_proveedor || []).map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
                </select>
              </div>
            </div>

            {/* RESERVAS PENDIENTES */}
            {reservasPendientes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.fl}>Reservas pendientes de pago</label>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #1e3a5f", borderRadius: 8 }}>
                  {reservasPendientes.map(r => (
                    <div key={r.id} onClick={() => selReserva(r)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #0f2040", background: reservaSel?.id === r.id ? "#1e3a5f" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
                        <span style={{ fontSize: 12, marginLeft: 8 }}>{r.pasajero_nombre}</span>
                        <div style={{ fontSize: 10, color: "#7a9cc8" }}>{r.destino} · {fmtD(r.fecha_in)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{fmt(r.saldo_pendiente, r.moneda)}</div>
                        {r.saldo_pendiente < r.neto && <div style={{ fontSize: 9, color: "#4a6fa5" }}>de {fmt(r.neto, r.moneda)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {f.proveedor_id && reservasPendientes.length === 0 && (
              <div style={{ fontSize: 11, color: "#10b981", marginBottom: 14 }}>✅ Sin deudas pendientes con este proveedor</div>
            )}
          </div>
        )}

        {/* COBRO A CLIENTE */}
        {f.tipo === "cobro_cliente" && (
          <div>
            <div style={S.fg}><label style={S.fl}>Cliente (nombre libre)</label><input style={S.inp} value={f.cliente_nombre} onChange={e => set("cliente_nombre", e.target.value)} placeholder="O seleccioná una reserva abajo..." /></div>
            {reservasPendientes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.fl}>Reservas con cobro pendiente</label>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #1e3a5f", borderRadius: 8 }}>
                  {reservasPendientes.map(r => (
                    <div key={r.id} onClick={() => selReserva(r)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #0f2040", background: reservaSel?.id === r.id ? "#1e3a5f" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
                        <span style={{ fontSize: 12, marginLeft: 8 }}>{r.pasajero_nombre}</span>
                        <div style={{ fontSize: 10, color: "#7a9cc8" }}>{r.destino} · {fmtD(r.fecha_in)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>{fmt(r.pendiente_cobro, r.moneda)}</div>
                        <div style={{ fontSize: 9, color: "#4a6fa5" }}>de {fmt(r.venta, r.moneda)} · cobrado {fmt(r.cobrado, r.moneda)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MONTO Y CUENTA */}
        <div style={S.g2}>
          <div style={S.fg}><label style={S.fl}>Cuenta bancaria</label>
            <select style={S.sel} value={f.desde_cuenta_id} onChange={e => set("desde_cuenta_id", e.target.value)}>
              <option value="">Seleccionar...</option>
              {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
            </select>
          </div>
          <div style={S.fg}><label style={S.fl}>Moneda del pago</label>
            <select style={S.sel} value={f.moneda_origen} onChange={e => set("moneda_origen", e.target.value)}>
              <option>USD</option><option>ARS</option><option>EUR</option>
            </select>
          </div>
          <div style={S.fg}><label style={S.fl}>Monto</label>
            <input style={S.inp} type="number" value={f.monto_origen} onChange={e => set("monto_origen", e.target.value)} placeholder="0.00" />
          </div>
          <div style={S.fg}><label style={S.fl}>Tipo de cambio</label>
            <input style={S.inp} type="number" value={f.tc} onChange={e => set("tc", e.target.value)} />
          </div>
        </div>

        {/* Mostrar equivalente si hay conversión */}
        {reservaSel && f.moneda_origen !== reservaSel.moneda && f.monto_origen && (
          <div style={{ padding: "8px 12px", background: "#0a2d1e", borderRadius: 8, marginBottom: 14, fontSize: 11 }}>
            💱 Equivale a <strong style={{ color: "#10b981" }}>{fmt(montoEnMonedaReserva(), reservaSel.moneda)}</strong> — descuenta de los <strong>{fmt(reservaSel.saldo_pendiente, reservaSel.moneda)}</strong> pendientes
          </div>
        )}

        {/* Saldo que quedaría */}
        {reservaSel && f.monto_origen && (
          <div style={{ padding: "8px 12px", background: "#080f1a", borderRadius: 8, marginBottom: 14, fontSize: 11 }}>
            Saldo pendiente tras el pago: <strong style={{ color: Math.max(0, (reservaSel.saldo_pendiente || 0) - (montoEnMonedaReserva() || 0)) <= 0 ? "#10b981" : "#f59e0b" }}>
              {fmt(Math.max(0, (reservaSel.saldo_pendiente || 0) - (montoEnMonedaReserva() || parseFloat(f.monto_origen) || 0)), reservaSel.moneda)}
            </strong>
            {Math.max(0, (reservaSel.saldo_pendiente || 0) - (montoEnMonedaReserva() || 0)) <= 0 && <span style={{ color: "#10b981", marginLeft: 8 }}>→ Se marcará como Pagada ✅</span>}
          </div>
        )}

        <div style={S.fg}><label style={S.fl}>Concepto *</label><input style={S.inp} value={f.concepto} onChange={e => set("concepto", e.target.value)} /></div>
        {f.tipo !== "pago_proveedor" && <div style={S.fg}><label style={S.fl}>Código de reserva (opcional)</label><input style={S.inp} value={f.reserva_cod} onChange={e => set("reserva_cod", e.target.value)} placeholder="LT-2026-XXX" /></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnS("ghost")} onClick={onClose}>Cancelar</button>
          <button style={{ ...btnS("pri"), opacity: saving ? 0.7 : 1 }} onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "✓ Registrar"}</button>
        </div>
      </div>
    </div>
  );
}

// ══ FINANZAS ══
function Finanzas({ cuentasBancarias, proveedores, user }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState("resumen");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [cobrosPendientes, setCobros] = useState([]);
  const [deudasPendientes, setDeudas] = useState([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: movs }, { data: reservas }, { data: movsCobros }] = await Promise.all([
      supabase.from("movimientos").select("*").order("fecha", { ascending: false }).limit(100),
      supabase.from("reservas").select("id,codigo,tipo,pasajero_nombre,destino,moneda,venta,neto,saldo_pendiente,proveedor_nombre,fecha_in,estado").not("estado", "in", "(Cancelada,Cerrada)"),
      supabase.from("movimientos").select("reserva_cod,monto_origen,moneda_origen,tc").eq("tipo", "cobro_cliente"),
    ]);
    setMovimientos(movs || []);

    // Calcular cobros pendientes
    const cobradoPorRes = {};
    (movsCobros || []).forEach(m => {
      if (m.reserva_cod) cobradoPorRes[m.reserva_cod] = (cobradoPorRes[m.reserva_cod] || 0) + (m.monto_origen || 0);
    });
    const cobros = (reservas || []).map(r => ({
      ...r,
      cobrado: cobradoPorRes[r.codigo] || 0,
      pendiente: Math.max(0, (r.venta || 0) - (cobradoPorRes[r.codigo] || 0)),
    })).filter(r => r.pendiente > 0);
    setCobros(cobros);

    // Deudas pendientes = reservas con saldo_pendiente > 0
    const deudas = (reservas || []).filter(r => (r.saldo_pendiente || 0) > 0);
    setDeudas(deudas);

    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalUSD = cuentasBancarias.filter(c => c.moneda === "USD").reduce((s, c) => s + (c.saldo || 0), 0);
  const totalARS = cuentasBancarias.filter(c => c.moneda === "ARS").reduce((s, c) => s + (c.saldo || 0), 0);
  const totalCobrar = cobrosPendientes.filter(r => r.moneda === "USD").reduce((s, r) => s + r.pendiente, 0);
  const totalDeber = deudasPendientes.filter(r => r.moneda === "USD").reduce((s, r) => s + (r.saldo_pendiente || 0), 0);

  const TABS = ["resumen", "cobros", "deudas", "movimientos", "bancos"];
  const TABS_LABEL = { resumen: "Resumen", cobros: "💚 A cobrar", deudas: "🔴 A pagar", movimientos: "Movimientos", bancos: "Bancos" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={S.pt}>Finanzas</div>
        <button style={btnS("pri")} onClick={() => setModalNuevo(true)}>+ Movimiento</button>
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#080f1a", borderRadius: 8, padding: 4, flexWrap: "wrap" }}>
        {TABS.map(s => <button key={s} style={{ ...btnS(subPage === s ? "secondary" : "ghost", "sm"), flex: 1, justifyContent: "center", minWidth: 80 }} onClick={() => setSubPage(s)}>{TABS_LABEL[s]}</button>)}
      </div>

      {subPage === "resumen" && (
        <div>
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <Stat label="Posición USD" value={fmt(totalUSD, "USD")} color={totalUSD >= 0 ? "#10b981" : "#ef4444"} />
            <Stat label="Posición ARS" value={fmt(totalARS, "ARS")} color={totalARS >= 0 ? "#10b981" : "#ef4444"} />
            <Stat label="A cobrar (USD)" value={fmt(totalCobrar, "USD")} color="#10b981" />
            <Stat label="A pagar (USD)" value={fmt(totalDeber, "USD")} color="#ef4444" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <div style={S.stitle}>🏦 Cuentas propias</div>
              {cuentasBancarias.map(c => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#080f1a", borderRadius: 6, marginBottom: 5 }}><div><div style={{ fontSize: 12, fontWeight: 500 }}>{c.nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{c.tipo} · {c.moneda}</div></div><span style={{ fontWeight: 700, fontSize: 12, color: (c.saldo || 0) >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo || 0, c.moneda)}</span></div>)}
            </div>
            <div style={S.card}>
              <div style={S.stitle}>🏢 Proveedores</div>
              {proveedores.map(p => <div key={p.id} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#7a9cc8", marginBottom: 4 }}>{p.nombre}</div>{(p.cuentas_proveedor || []).map(c => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "#080f1a", borderRadius: 5, marginBottom: 3 }}><span style={{ fontSize: 11, color: "#4a6fa5" }}>{c.nombre}</span><span style={{ fontWeight: 700, fontSize: 11, color: (c.saldo || 0) >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo || 0, c.moneda)}</span></div>)}</div>)}
            </div>
          </div>
        </div>
      )}

      {subPage === "cobros" && (
        <div>
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <Stat label="Total a cobrar USD" value={fmt(totalCobrar, "USD")} color="#10b981" />
            <Stat label="Reservas pendientes" value={cobrosPendientes.length} color="#c9a84c" />
          </div>
          {loading ? <Spinner /> : cobrosPendientes.length === 0
            ? <div style={{ ...S.card, textAlign: "center", padding: 40, color: "#10b981" }}>✅ Sin cobros pendientes</div>
            : <Tabla
                cols={["Código", "Pasajero", "Destino", "Venta", "Cobrado", "Pendiente", "Fecha viaje"]}
                rows={cobrosPendientes.sort((a, b) => (a.fecha_in || "").localeCompare(b.fecha_in || "")).map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontFamily: "monospace", color: "#c9a84c", fontSize: 11 }}>{r.codigo}</td>
                    <td style={S.td}><div style={{ fontWeight: 500 }}>{r.pasajero_nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.tipo}</div></td>
                    <td style={S.td}>{r.destino}</td>
                    <td style={S.td}>{fmt(r.venta, r.moneda)}</td>
                    <td style={{ ...S.td, color: "#10b981" }}>{fmt(r.cobrado, r.moneda)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#f59e0b" }}>{fmt(r.pendiente, r.moneda)}</td>
                    <td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(r.fecha_in)}</td>
                  </tr>
                ))}
              />
          }
        </div>
      )}

      {subPage === "deudas" && (
        <div>
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <Stat label="Total a pagar USD" value={fmt(totalDeber, "USD")} color="#ef4444" />
            <Stat label="Reservas con deuda" value={deudasPendientes.length} color="#c9a84c" />
          </div>
          {loading ? <Spinner /> : deudasPendientes.length === 0
            ? <div style={{ ...S.card, textAlign: "center", padding: 40, color: "#10b981" }}>✅ Sin deudas pendientes</div>
            : <Tabla
                cols={["Código", "Pasajero", "Proveedor", "Neto", "Pendiente", "Fecha viaje", "Estado"]}
                rows={deudasPendientes.sort((a, b) => (a.fecha_in || "").localeCompare(b.fecha_in || "")).map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontFamily: "monospace", color: "#c9a84c", fontSize: 11 }}>{r.codigo}</td>
                    <td style={S.td}>{r.pasajero_nombre}</td>
                    <td style={S.td}><div style={{ fontWeight: 500 }}>{r.proveedor_nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5" }}>{r.tipo}</div></td>
                    <td style={S.td}>{fmt(r.neto, r.moneda)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#ef4444" }}>{fmt(r.saldo_pendiente, r.moneda)}</td>
                    <td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(r.fecha_in)}</td>
                    <td style={S.td}><Badge estado={r.estado} /></td>
                  </tr>
                ))}
              />
          }
        </div>
      )}

      {subPage === "movimientos" && (loading ? <Spinner /> : <Tabla cols={["Fecha", "Tipo", "Concepto", "Monto", "Reserva"]} rows={movimientos.map(m => { const esCobro = m.tipo === "cobro_cliente" || m.tipo === "ingreso"; return <tr key={m.id}><td style={{ ...S.td, fontSize: 11, color: "#7a9cc8" }}>{fmtD(m.fecha)}</td><td style={S.td}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#1e2a3a", color: MOV_C[m.tipo] || "#94a3b8" }}>{TIPOS_MOV[m.tipo] || m.tipo}</span></td><td style={{ ...S.td, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto}</td><td style={{ ...S.td, fontWeight: 700, color: esCobro ? "#10b981" : "#ef4444" }}>{esCobro ? "+" : "-"}{fmt(m.monto_origen, m.moneda_origen)}</td><td style={{ ...S.td, fontSize: 11, color: "#c9a84c", fontFamily: "monospace" }}>{m.reserva_cod || "—"}</td></tr>; })} />)}

      {subPage === "bancos" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>{cuentasBancarias.map(c => <div key={c.id} style={{ ...S.card, borderColor: (c.saldo || 0) < 0 ? "#ef444433" : "#1e3a5f" }}><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{c.nombre}</div><div style={{ fontSize: 10, color: "#4a6fa5", marginBottom: 10, textTransform: "capitalize" }}>{c.tipo} · {c.moneda}</div><div style={{ fontSize: 22, fontWeight: 800, color: (c.saldo || 0) >= 0 ? "#10b981" : "#ef4444" }}>{fmt(c.saldo || 0, c.moneda)}</div></div>)}</div>}

      {modalNuevo && <ModalMovimiento proveedores={proveedores} cuentasBancarias={cuentasBancarias} user={user} onSave={() => { setModalNuevo(false); cargar(); }} onClose={() => setModalNuevo(false)} />}
    </div>
  );
}

// ══ ALERTAS ══
const ALERTA_CFG = { vencimiento_pago: { icon: "💳", color: "#ef4444" }, vencimiento_cobro: { icon: "💵", color: "#f97316" }, vencimiento_reserva: { icon: "⏰", color: "#f59e0b" }, viaje_proximo: { icon: "✈️", color: "#3b82f6" }, sin_seguro: { icon: "🛡️", color: "#8b5cf6" } };
function Alertas({ alertas, onDescartar }) {
  const urgentes = alertas.filter(a => a.urgente);
  const normales = alertas.filter(a => !a.urgente);
  function AlertaItem({ a }) {
    const cfg = ALERTA_CFG[a.tipo] || { icon: "⚠️", color: "#94a3b8" };
    return <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: a.urgente ? "#1a0a0a" : "#0d1829", border: "1px solid " + (a.urgente ? cfg.color + "44" : "#1e3a5f"), borderRadius: 10, marginBottom: 8 }}><span style={{ fontSize: 20, flexShrink: 0 }}>{cfg.icon}</span><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{a.msg}</span>{a.urgente && <span style={{ fontSize: 9, fontWeight: 700, background: cfg.color, color: "#fff", padding: "1px 6px", borderRadius: 8 }}>URGENTE</span>}</div><div style={{ fontSize: 11, color: "#7a9cc8", marginTop: 2 }}>{a.sub}</div></div><button style={btnS("ghost", "sm")} onClick={() => onDescartar(a.id)}>✓</button></div>;
  }
  return (
    <div>
      <div style={S.pt}>Alertas</div>
      <div style={S.ps}>{alertas.length} activas · {urgentes.length} urgentes</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}><Stat label="Urgentes" value={urgentes.length} color="#ef4444" /><Stat label="Venc. pago" value={alertas.filter(a => a.tipo === "vencimiento_pago").length} color="#ef4444" /><Stat label="Venc. cobro" value={alertas.filter(a => a.tipo === "vencimiento_cobro").length} color="#f97316" /><Stat label="Viajes próximos" value={alertas.filter(a => a.tipo === "viaje_proximo").length} color="#3b82f6" /><Stat label="Sin seguro" value={alertas.filter(a => a.tipo === "sin_seguro").length} color="#8b5cf6" /></div>
      {urgentes.length > 0 && <div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🚨 Urgentes</div>{urgentes.map(a => <AlertaItem key={a.id} a={a} />)}</div>}
      {normales.length > 0 && <div><div style={{ fontSize: 10, fontWeight: 700, color: "#7a9cc8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📋 Avisos</div>{normales.map(a => <AlertaItem key={a.id} a={a} />)}</div>}
      {alertas.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 60 }}><div style={{ fontSize: 40, marginBottom: 10 }}>✅</div><div style={{ color: "#10b981", fontWeight: 600 }}>Sin alertas activas</div></div>}
    </div>
  );
}

// ══ DOCUMENTOS ══
function Documentos() {
  const [reservas, setReservas] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msgEnvio, setMsgEnvio] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: d }] = await Promise.all([
      supabase.from("reservas").select("*").neq("tipo", "Aéreo").order("created_at", { ascending: false }),
      supabase.from("reserva_docs").select("*").order("enviado_at", { ascending: false }).limit(50),
    ]);
    setReservas(r || []);
    setDocs(d || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function enviar(r, tipo) {
    setSaving(true);
    setMsgEnvio("");
    const asunto = tipo === "confirmacion" ? "✅ Confirmación de reserva — " + r.destino : "🎫 Voucher de viaje — " + r.destino;
    const html = tipo === "confirmacion" ? htmlConfirmacion(r) : htmlVoucher(r);

    // Mandar mail real
    let mailOk = false;
    if (r.pasajero_mail) {
      const res = await sendEmail(r.pasajero_mail, asunto, html);
      mailOk = res.ok;
      if (!res.ok) setMsgEnvio("⚠️ Error al enviar mail: " + (res.error || "desconocido"));
      else setMsgEnvio("✅ Mail enviado a " + r.pasajero_mail);
    } else {
      setMsgEnvio("⚠️ El pasajero no tiene email cargado — se registró sin enviar");
    }

    // Registrar en BD
    await supabase.from("reserva_docs").insert([{
      reserva_id: r.id, tipo, asunto, para_mail: r.pasajero_mail,
      enviado: mailOk,
    }]);
    setSaving(false);
    setSel(null);
    cargar();
  }

  const disponibles = reservas.filter(r => r.estado !== "Cancelada");

  return (
    <div>
      <div style={S.pt}>Documentos</div>
      <div style={S.ps}>Confirmaciones y vouchers (excluye aéreos)</div>
      {msgEnvio && <div style={{ padding: "10px 14px", background: msgEnvio.startsWith("✅") ? "#0a2d1e" : "#2d1a0a", borderRadius: 8, marginBottom: 16, fontSize: 12, color: msgEnvio.startsWith("✅") ? "#10b981" : "#f59e0b" }}>{msgEnvio}</div>}
      {loading ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Reservas</div>
            {disponibles.length === 0 && <div style={{ ...S.card, fontSize: 12, color: "#4a6fa5" }}>Sin reservas no-aéreas activas</div>}
            {disponibles.map(r => {
              const puedeVoucher = r.estado === "Pagada";
              const puedeConf = ["Confirmada", "Pagada"].includes(r.estado);
              const docsR = docs.filter(d => d.reserva_id === r.id);
              return (
                <div key={r.id} style={{ ...S.card, marginBottom: 10 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
                    <span style={{ marginLeft: 8 }}><Badge estado={r.estado} /></span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: "#4a6fa5" }}>{r.tipo}</span>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{r.pasajero_nombre}</div>
                    <div style={{ fontSize: 11, color: "#7a9cc8" }}>{r.destino} · {fmtD(r.fecha_in)}</div>
                    {!r.pasajero_mail && <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>⚠️ Sin email</div>}
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button style={{ ...btnS(puedeConf ? "blue" : "ghost", "sm"), opacity: puedeConf ? 1 : 0.4, cursor: puedeConf ? "pointer" : "not-allowed" }} onClick={() => puedeConf && setSel({ r, tipo: "confirmacion" })}>
                      ✅ {docsR.some(d => d.tipo === "confirmacion") ? "Re-enviar" : "Confirmación"}
                    </button>
                    <button style={{ ...btnS(puedeVoucher ? "success" : "ghost", "sm"), opacity: puedeVoucher ? 1 : 0.4, cursor: puedeVoucher ? "pointer" : "not-allowed" }} onClick={() => puedeVoucher && setSel({ r, tipo: "voucher" })}>
                      🎫 {docsR.some(d => d.tipo === "voucher") ? "Re-enviar" : "Voucher"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Historial de envíos</div>
            <div style={S.card}>
              {docs.map((d, i) => {
                const r = reservas.find(x => x.id === d.reserva_id);
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #0f2040" }}>
                    <span style={{ fontSize: 18 }}>{d.tipo === "confirmacion" ? "✅" : "🎫"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{d.asunto}</div>
                      <div style={{ fontSize: 10, color: "#4a6fa5" }}>{r?.pasajero_nombre} · {fmtD((d.enviado_at || "").slice(0, 10))}</div>
                      <div style={{ fontSize: 10, color: d.enviado ? "#10b981" : "#f59e0b" }}>{d.enviado ? "✓ Enviado" : "⚠ Sin mail"}</div>
                    </div>
                  </div>
                );
              })}
              {docs.length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>Sin envíos</div>}
            </div>
          </div>
        </div>
      )}
      {sel && (
        <div style={S.modal} onClick={() => setSel(null)}>
          <div style={mbox(480)} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontWeight: 700 }}>{sel.tipo === "confirmacion" ? "✅ Enviar confirmación" : "🎫 Enviar voucher"}</div>
              <button style={btnS("ghost", "sm")} onClick={() => setSel(null)}>✕</button>
            </div>
            <div style={{ padding: "14px", background: "#080f1a", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <strong>{sel.r.pasajero_nombre}</strong><br />
              <span style={{ color: sel.r.pasajero_mail ? "#10b981" : "#f59e0b" }}>
                {sel.r.pasajero_mail || "⚠️ Sin email — se registrará sin enviar"}
              </span><br />
              <span style={{ color: "#4a6fa5" }}>{sel.r.codigo} · {sel.r.destino} · {fmtD(sel.r.fecha_in)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnS("ghost")} onClick={() => setSel(null)}>Cancelar</button>
              <button style={{ ...btnS(sel.tipo === "confirmacion" ? "blue" : "success"), opacity: saving ? 0.7 : 1 }} onClick={() => enviar(sel.r, sel.tipo)} disabled={saving}>
                {saving ? "Enviando..." : sel.tipo === "confirmacion" ? "✅ Enviar" : "🎫 Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══ EXPEDIENTES ══
function Expedientes({ clientes, user }) {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "nuevo" | expediente
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("expedientes").select("*, reservas(id,codigo,tipo,estado,destino,fecha_in,fecha_out,proveedor_nombre,moneda,neto,venta,saldo_pendiente,pasajero_nombre)").order("created_at", { ascending: false });
    setExpedientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={S.pt}>Expedientes</div><div style={S.ps}>{expedientes.length} expedientes</div></div>
        <button style={btnS("pri")} onClick={() => setModal("nuevo")}>+ Nuevo expediente</button>
      </div>
      {loading ? <Spinner /> : (
        expedientes.length === 0
          ? <div style={{ ...S.card, textAlign: "center", padding: 60, color: "#4a6fa5" }}>Ningún expediente todavía. Creá uno para agrupar servicios de un mismo viaje.</div>
          : expedientes.map(exp => {
            const reservas = exp.reservas || [];
            const totalVenta = reservas.reduce((s, r) => r.moneda === "USD" ? s + (r.venta || 0) : s, 0);
            const totalPendiente = reservas.reduce((s, r) => r.moneda === "USD" ? s + (r.saldo_pendiente || 0) : s, 0);
            const estados = [...new Set(reservas.map(r => r.estado))];
            return (
              <div key={exp.id} style={{ ...S.card, marginBottom: 12, cursor: "pointer" }} onClick={() => setDetalle(exp)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{exp.codigo}</span>
                      <span style={{ fontSize: 11, color: "#4a6fa5", background: "#0f2040", padding: "2px 8px", borderRadius: 10 }}>{exp.estado}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{exp.nombre}</div>
                    <div style={{ fontSize: 12, color: "#7a9cc8", marginTop: 2 }}>{exp.pasajero_nombre}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c" }}>{fmt(totalVenta, "USD")}</div>
                    {totalPendiente > 0 && <div style={{ fontSize: 11, color: "#ef4444" }}>{fmt(totalPendiente, "USD")} pendiente</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {reservas.map(r => (
                    <span key={r.id} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: "#0f2040", color: "#7a9cc8", border: "1px solid #1e3a5f" }}>
                      {r.tipo} · {r.destino} · <Badge estado={r.estado} />
                    </span>
                  ))}
                  {reservas.length === 0 && <span style={{ fontSize: 11, color: "#4a6fa5" }}>Sin servicios asignados</span>}
                </div>
              </div>
            );
          })
      )}
      {modal && <ModalExpediente expediente={modal === "nuevo" ? null : modal} clientes={clientes} user={user} onSave={() => { setModal(null); cargar(); }} onClose={() => setModal(null)} />}
      {detalle && <DetalleExpediente expediente={detalle} onClose={() => { setDetalle(null); cargar(); }} user={user} />}
    </div>
  );
}

function ModalExpediente({ expediente, clientes, user, onSave, onClose }) {
  const esNuevo = !expediente;
  const [nombre, setNombre] = useState(expediente?.nombre || "");
  const [pasajero, setPasajero] = useState(expediente?.pasajero_nombre || "");
  const [clienteId, setClienteId] = useState(expediente?.cliente_id || null);
  const [notas, setNotas] = useState(expediente?.notas || "");
  const [busq, setBusq] = useState(expediente?.pasajero_nombre || "");
  const [mostrarBusq, setMostrarBusq] = useState(false);
  const [saving, setSaving] = useState(false);

  const clientesFiltrados = clientes.filter(c => {
    const s = busq.toLowerCase();
    return s.length >= 2 && (c.nombre + " " + c.apellido).toLowerCase().includes(s);
  }).slice(0, 6);

  async function guardar() {
    if (!nombre) { alert("El nombre es requerido"); return; }
    setSaving(true);
    let codigo = expediente?.codigo;
    if (!codigo) {
      const { count } = await supabase.from("expedientes").select("*", { count: "exact", head: true });
      codigo = "EXP-" + new Date().getFullYear() + "-" + String((count || 0) + 1).padStart(3, "0");
    }
    const payload = { codigo, nombre, pasajero_nombre: pasajero, cliente_id: clienteId || null, notas };
    let error;
    if (esNuevo) { ({ error } = await supabase.from("expedientes").insert([payload])); }
    else { ({ error } = await supabase.from("expedientes").update(payload).eq("id", expediente.id)); }
    setSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    onSave();
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={mbox(500)} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{esNuevo ? "Nuevo expediente" : "Editar expediente"}</div>
          <button style={btnS("ghost", "sm")} onClick={onClose}>✕</button>
        </div>
        <div style={S.fg}><label style={S.fl}>Nombre del viaje *</label><input style={S.inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Miami Abril 2026 — Familia Altberg" /></div>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <label style={S.fl}>Buscar pasajero</label>
          <input style={S.inp} value={busq} onChange={e => { setBusq(e.target.value); setMostrarBusq(true); }} onFocus={() => setMostrarBusq(true)} onBlur={() => setTimeout(() => setMostrarBusq(false), 200)} placeholder="Nombre o apellido..." />
          {mostrarBusq && clientesFiltrados.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1829", border: "1px solid #1e3a5f", borderRadius: 8, zIndex: 100 }}>
              {clientesFiltrados.map(c => <div key={c.id} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e3a5f", fontSize: 12 }} onMouseDown={() => { setPasajero(c.nombre + " " + c.apellido); setClienteId(c.id); setBusq(c.nombre + " " + c.apellido); setMostrarBusq(false); }}>{c.nombre} {c.apellido}</div>)}
            </div>
          )}
        </div>
        <div style={S.fg}><label style={S.fl}>Notas</label><textarea style={{ ...S.inp, minHeight: 70, resize: "vertical" }} value={notas} onChange={e => setNotas(e.target.value)} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnS("ghost")} onClick={onClose}>Cancelar</button>
          <button style={{ ...btnS("pri"), opacity: saving ? 0.7 : 1 }} onClick={guardar} disabled={saving}>{saving ? "Guardando..." : esNuevo ? "✓ Crear" : "✓ Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function DetalleExpediente({ expediente, onClose, user }) {
  const [reservasExp, setReservasExp] = useState(expediente.reservas || []);
  const [todasReservas, setTodasReservas] = useState([]);
  const [asignando, setAsignando] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("reservas").select("id,codigo,tipo,estado,destino,fecha_in,proveedor_nombre,moneda,neto,venta,saldo_pendiente,pasajero_nombre,expediente_id")
      .is("expediente_id", null).not("estado", "in", "(Cancelada,Cerrada)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTodasReservas(data || []));
  }, []);

  async function asignar(r) {
    setLoading(true);
    await supabase.from("reservas").update({ expediente_id: expediente.id }).eq("id", r.id);
    const { data } = await supabase.from("expedientes").select("*, reservas(id,codigo,tipo,estado,destino,fecha_in,fecha_out,proveedor_nombre,moneda,neto,venta,saldo_pendiente,pasajero_nombre)").eq("id", expediente.id).single();
    setReservasExp(data?.reservas || []);
    setTodasReservas(prev => prev.filter(x => x.id !== r.id));
    setLoading(false);
  }

  async function desasignar(r) {
    setLoading(true);
    await supabase.from("reservas").update({ expediente_id: null }).eq("id", r.id);
    setReservasExp(prev => prev.filter(x => x.id !== r.id));
    setTodasReservas(prev => [...prev, { ...r, expediente_id: null }]);
    setLoading(false);
  }

  const totalVenta = reservasExp.reduce((s, r) => r.moneda === "USD" ? s + (r.venta || 0) : s, 0);
  const totalNeto = reservasExp.reduce((s, r) => r.moneda === "USD" ? s + (r.neto || 0) : s, 0);
  const totalPendiente = reservasExp.reduce((s, r) => r.moneda === "USD" ? s + (r.saldo_pendiente || 0) : s, 0);

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{ ...mbox(700), maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c", marginBottom: 3 }}>{expediente.codigo}</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{expediente.nombre}</div>
            <div style={{ fontSize: 12, color: "#7a9cc8" }}>{expediente.pasajero_nombre}</div>
          </div>
          <button style={btnS("ghost", "sm")} onClick={onClose}>✕</button>
        </div>

        {/* Totales */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <Stat label="Venta total" value={fmt(totalVenta, "USD")} color="#c9a84c" />
          <Stat label="Neto total" value={fmt(totalNeto, "USD")} color="#ef4444" />
          <Stat label="Margen" value={fmt(totalVenta - totalNeto, "USD")} color="#10b981" />
          <Stat label="Pendiente pago" value={fmt(totalPendiente, "USD")} color={totalPendiente > 0 ? "#f59e0b" : "#10b981"} />
        </div>

        {/* Servicios asignados */}
        <div style={S.stitle}>Servicios del expediente</div>
        {reservasExp.length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5", marginBottom: 16 }}>Sin servicios asignados todavía</div>}
        {reservasExp.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#080f1a", borderRadius: 8, marginBottom: 8 }}>
            <div>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: "#4a6fa5" }}>{r.tipo}</span>
              <span style={{ marginLeft: 8 }}><Badge estado={r.estado} /></span>
              <div style={{ fontSize: 12, marginTop: 2 }}>{r.destino} · {fmtD(r.fecha_in)}</div>
              <div style={{ fontSize: 11, color: "#7a9cc8" }}>{r.proveedor_nombre}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(r.venta, r.moneda)}</div>
              {(r.saldo_pendiente || 0) > 0 && <div style={{ fontSize: 10, color: "#ef4444" }}>{fmt(r.saldo_pendiente, r.moneda)} pendiente</div>}
              <button style={{ ...btnS("ghost", "sm"), marginTop: 4, fontSize: 10 }} onClick={() => desasignar(r)}>Quitar</button>
            </div>
          </div>
        ))}

        {/* Asignar reservas */}
        <div style={{ marginTop: 16 }}>
          <button style={{ ...btnS(asignando ? "secondary" : "ghost"), marginBottom: 12 }} onClick={() => setAsignando(!asignando)}>
            {asignando ? "▲ Cerrar" : "+ Agregar servicio"}
          </button>
          {asignando && (
            <div>
              <div style={{ fontSize: 11, color: "#4a6fa5", marginBottom: 8 }}>Reservas sin expediente asignado:</div>
              {todasReservas.length === 0 && <div style={{ fontSize: 12, color: "#4a6fa5" }}>No hay reservas disponibles</div>}
              {todasReservas.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#080f1a", borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c9a84c" }}>{r.codigo}</span>
                    <span style={{ marginLeft: 8, fontSize: 11 }}>{r.tipo} · {r.destino}</span>
                    <div style={{ fontSize: 11, color: "#7a9cc8" }}>{r.pasajero_nombre} · {fmtD(r.fecha_in)}</div>
                  </div>
                  <button style={btnS("blue", "sm")} onClick={() => asignar(r)} disabled={loading}>+ Asignar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {expediente.notas && <div style={{ marginTop: 16, padding: "12px 14px", background: "#080f1a", borderRadius: 8, fontSize: 12, color: "#7a9cc8" }}>{expediente.notas}</div>}
      </div>
    </div>
  );
}

// ══ APP PRINCIPAL ══
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [reservasDash, setReservasDash] = useState([]);
  const [movimientosDash, setMovimientosDash] = useState([]);
  const [alertasDesc, setAlertasDesc] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(async function({ data: { session } }) {
      if (session) {
        const { data: perfil } = await supabase.from("usuarios").select("*").eq("id", session.user.id).single();
        setUser(perfil || { id: session.user.id, nombre: session.user.email.split("@")[0], email: session.user.email, rol: "vendedor", iniciales: session.user.email.slice(0, 2).toUpperCase(), color: "#3b82f6" });
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(function(_e, session) { if (!session) setUser(null); });
    return function() { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("proveedores").select("*, cuentas_proveedor(*)").order("nombre"),
      supabase.from("cuentas_bancarias").select("*").order("nombre"),
      supabase.from("reservas").select("*").order("created_at", { ascending: false }),
      supabase.from("movimientos").select("*").order("fecha", { ascending: false }).limit(20),
      supabase.from("clientes").select("*").order("apellido"),
    ]).then(function([{ data: p }, { data: cb }, { data: r }, { data: m }, { data: c }]) {
      setProveedores(p || []);
      setCuentasBancarias(cb || []);
      setReservasDash(r || []);
      setMovimientosDash(m || []);
      setClientes(c || []);
    });
  }, [user]);

  async function handleLogout() { await supabase.auth.signOut(); setUser(null); }

  const alertasAll = generarAlertas(reservasDash).filter(function(a) { return !alertasDesc.includes(a.id); });
  const alertasUrgentes = alertasAll.filter(function(a) { return a.urgente; }).length;

  if (loading) return <div style={{ minHeight: "100vh", background: "#080f1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c", fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>Cargando...</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div style={{ minHeight: "100vh", background: "#080f1a", color: "#e2e8f0", fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex" }}>
      <Sidebar page={page} setPage={setPage} alertasCount={alertasUrgentes} user={user} onLogout={handleLogout} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ background: "#0d1829", borderBottom: "1px solid #1e3a5f", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#7a9cc8" }}>{(NAV.find(function(n) { return n.id === page; }) || {}).icon} <strong style={{ color: "#e2e8f0" }}>{(NAV.find(function(n) { return n.id === page; }) || {}).label}</strong></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {alertasUrgentes > 0 && <button style={{ ...btnS("ghost", "sm"), color: "#ef4444", borderColor: "#ef444433" }} onClick={() => setPage("alertas")}>🚨 {alertasUrgentes} urgente{alertasUrgentes > 1 ? "s" : ""}</button>}
            <span style={{ fontSize: 11, color: "#4a6fa5" }}>{fmtD(hoy())}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {page === "dashboard" && <Dashboard reservas={reservasDash} movimientos={movimientosDash} alertas={alertasAll} setPage={setPage} />}
          {page === "expedientes" && <Expedientes clientes={clientes} user={user} />}
          {page === "reservas" && <Reservas proveedores={proveedores} clientes={clientes} user={user} />}
          {page === "clientes" && <Clientes />}
          {page === "proveedores" && <Proveedores proveedores={proveedores} />}
          {page === "finanzas" && <Finanzas cuentasBancarias={cuentasBancarias} proveedores={proveedores} user={user} />}
          {page === "alertas" && <Alertas alertas={alertasAll} onDescartar={function(id) { setAlertasDesc(function(d) { return [...d, id]; }); }} />}
          {page === "documentos" && <Documentos />}
        </div>
      </div>
    </div>
  );
}
