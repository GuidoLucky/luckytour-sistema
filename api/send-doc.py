import json
import urllib.request
from http.server import BaseHTTPRequestHandler

RAILWAY_URL = "https://comparador-vuelos-production.up.railway.app/generar-doc"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))

        tipo    = body.get("tipo", "")
        reserva = body.get("reserva", {})

        try:
            # Railway espera { tipo, datos }
            payload = json.dumps({ "tipo": tipo, "datos": reserva }).encode()
            req = urllib.request.Request(
                RAILWAY_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                result = json.loads(resp.read())

            if not result.get("ok"):
                raise Exception(result.get("error", "Error en Railway"))

            # Construir subject, filename y nombre para que el frontend los use
            nombre_pax  = reserva.get("pasajero_nombre", "Pasajero")
            codigo      = reserva.get("codigo", "")
            destino     = reserva.get("destino", "")

            if tipo == "confirmacion":
                subject  = f"Confirmación de reserva — {destino} · {codigo}"
                filename = f"confirmacion_{codigo}.pdf"
            else:
                subject  = f"Voucher de viaje — {destino} · {codigo}"
                filename = f"voucher_{codigo}.pdf"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok":       True,
                "pdf":      result["pdf"],
                "subject":  subject,
                "filename": filename,
                "nombre":   nombre_pax,
            }).encode())

        except Exception as e:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
