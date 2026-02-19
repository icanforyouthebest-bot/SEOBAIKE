import azure.functions as func
import json
import os
import urllib.request
from datetime import datetime, timezone

def main(req: func.HttpRequest) -> func.HttpResponse:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    now = datetime.now(timezone.utc).isoformat()

    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}

    # Write to system_health
    health = {"component": "grok-takeover-app", "status": "healthy", "last_heartbeat": now, "metadata": json.dumps({"model": "grok-4", "takeover": True, "patent": "115100981"})}
    r = urllib.request.Request(f"{url}/rest/v1/system_health", data=json.dumps(health).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            result = json.loads(resp.read())
            return func.HttpResponse(json.dumps({"status": "Grok takeover active", "inserted": result, "timestamp": now}), mimetype="application/json")
    except Exception as e:
        # Try PATCH if conflict
        r2 = urllib.request.Request(f"{url}/rest/v1/system_health?component=eq.grok-takeover-app", data=json.dumps({"status": "healthy", "last_heartbeat": now}).encode(), headers=headers, method="PATCH")
        try:
            with urllib.request.urlopen(r2, timeout=10) as resp:
                result = json.loads(resp.read())
                return func.HttpResponse(json.dumps({"status": "Grok takeover heartbeat updated", "result": result, "timestamp": now}), mimetype="application/json")
        except Exception as e2:
            return func.HttpResponse(json.dumps({"error": str(e2), "timestamp": now}), status_code=500, mimetype="application/json")
