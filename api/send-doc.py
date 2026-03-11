import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

RAILWAY_URL = "https://comparador-vuelos-production.up.railway.app/generar-doc"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))

        tipo    = body.get("tipo", "")
        reserva = body.get("reserva", {})

        try:
            payload = json.dumps({ "tipo": tipo, "datos": reserva }).encode()
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

            # Mostrar raw en el error si falla el parse
            try:
                result = json.loads(raw)
            except Exception:
                self._respond({"ok": False, "error": f"Railway respuesta no-JSON: {raw[:300].decode('utf-8','replace')}"})
                return

            if not result.get("ok"):
                self._respond({"ok": False, "error": result.get("error", "Error en Railway")})
                return

            nombre_pax  = reserva.get("pasajero_nombre", "Pasajero")
            codigo      = reserva.get("codigo", "")
            destino     = reserva.get("destino", "")

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
