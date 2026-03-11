import json
import urllib.request

RAILWAY_URL = "https://comparador-vuelos-production.up.railway.app/generar-doc"

def handler(request):
    try:
        body = json.loads(request.body)
        tipo = body.get("tipo")
        datos = body.get("datos", {})

        payload = json.dumps({"tipo": tipo, "datos": datos}).encode()
        req = urllib.request.Request(
            RAILWAY_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read())

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(result)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"ok": False, "error": str(e)})
        }
