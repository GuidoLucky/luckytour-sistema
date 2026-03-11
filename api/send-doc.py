import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler
from datetime import datetime

RAILWAY_URL = "https://comparador-vuelos-production.up.railway.app/generar-doc"

def fmt_fecha(iso):
    if not iso:
        return ""
    try:
        return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except:
        return iso

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))

        tipo    = body.get("tipo", "")
        reserva = body.get("reserva", {})

        # Calcular noches
        noches = ""
        try:
            fi = datetime.strptime(reserva.get("fecha_in", "")[:10], "%Y-%m-%d")
            fo = datetime.strptime(reserva.get("fecha_out", "")[:10], "%Y-%m-%d")
            noches = str((fo - fi).days)
        except:
            pass

        # Armar pasajeros
        adultos = reserva.get("adultos", 1) or 1
        chd     = reserva.get("chd", 0) or 0
        inf     = reserva.get("inf", 0) or 0
        partes  = [f"{adultos} adulto{'s' if adultos != 1 else ''}"]
        if chd:  partes.append(f"{chd} niño{'s' if chd != 1 else ''}")
        if inf:  partes.append(f"{inf} infante{'s' if inf != 1 else ''}")
        pasajeros_str = ", ".join(partes)

        if tipo == "confirmacion":
            datos = {
                "fecha":         fmt_fecha(reserva.get("created_at") or datetime.now().strftime("%Y-%m-%d")),
                "hotel":         reserva.get("destino", ""),
                "titular":       reserva.get("pasajero_nombre", ""),
                "pasajeros":     pasajeros_str,
                "fecha_in":      fmt_fecha(reserva.get("fecha_in", "")),
                "fecha_out":     fmt_fecha(reserva.get("fecha_out", "")),
                "noches":        noches,
                "habitaciones":  reserva.get("habitacion", "-") or "-",
                "observaciones": reserva.get("notas", "N/A") or "N/A",
                "total":         f"{reserva.get('moneda','USD')} {reserva.get('venta','')}",
            }
        else:  # voucher
            datos = {
                "fecha":        fmt_fecha(reserva.get("created_at") or datetime.now().strftime("%Y-%m-%d")),
                "servicio":     reserva.get("destino", ""),
                "beneficiario": reserva.get("pasajero_nombre", ""),
                "fecha_in":     fmt_fecha(reserva.get("fecha_in", "")),
                "fecha_out":    fmt_fecha(reserva.get("fecha_out", "")),
                "noches":       noches,
                "hotel":        reserva.get("proveedor_nombre", ""),
                "codigo":       reserva.get("cod_proveedor", ""),
            }

        try:
            payload = json.dumps({ "tipo": tipo, "datos": datos }).encode()
            req = urllib.request.Request(
                RAILWAY_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=90) as resp:
                    raw = resp.read()
            except urllib.error.HTTPError as e:
                raw = e.read()
                self._respond({"ok": False, "error": f"Railway HTTP {e.code}: {raw[:300].decode('utf-8','replace')}"})
                return

            try:
                result = json.loads(raw)
            except Exception:
                self._respond({"ok": False, "error": f"Railway respuesta no-JSON: {raw[:300].decode('utf-8','replace')}"})
                return

            if not result.get("ok"):
                self._respond({"ok": False, "error": result.get("error", "Error en Railway")})
                return

            nombre_pax = reserva.get("pasajero_nombre", "Pasajero")
            codigo     = reserva.get("codigo", "")
            destino    = reserva.get("destino", "")

            if tipo == "confirmacion":
                subject  = f"Confirmación de reserva — {destino} · {codigo}"
                filename = f"confirmacion_{codigo}.pdf"
            else:
                subject  = f"Voucher de viaje — {destino} · {codigo}"
                filename = f"voucher_{codigo}.pdf"

            self._respond({
                "ok":       True,
                "pdf":      result["pdf"],
                "subject":  subject,
                "filename": filename,
                "nombre":   nombre_pax,
            })

        except Exception as e:
            self._respond({"ok": False, "error": str(e)})

    def _respond(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
