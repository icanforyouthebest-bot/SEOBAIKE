"""
SEOBAIKE Local Server - Microsoft + NVIDIA on localhost
python server.py -> http://localhost:8000
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import json
import sys
import os
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

PORT = 8000
NV_KEY = "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"
NV_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
SB_URL = "https://vmyrivxxibqydccurxug.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"

MODELS = {
    "deepseek": "deepseek-ai/deepseek-v3.2",
    "llama": "meta/llama-3.1-8b-instruct",
    "gemma": "google/gemma-3-27b-it",
    "phi": "microsoft/phi-4-mini-instruct",
    "mistral": "mistralai/mistral-large-3-675b-instruct-2512",
}


def sb_get(path):
    r = urllib.request.Request(f"{SB_URL}/rest/v1/{path}", headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    with urllib.request.urlopen(r, timeout=10) as resp:
        return json.loads(resp.read())


def nv_chat(model, messages, max_tokens=500):
    payload = json.dumps({"model": model, "messages": messages, "max_tokens": max_tokens}).encode()
    req = urllib.request.Request(NV_URL, data=payload, headers={"Content-Type": "application/json", "Authorization": f"Bearer {NV_KEY}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def check_l1l4(l1, l2, l3, l4):
    try:
        r1 = sb_get(f"l1_categories?id=eq.{l1}&select=id,name")
        if not r1: return {"status": "denied", "reason": f"L1 {l1} not found"}
        r2 = sb_get(f"l2_subcategories?id=eq.{l2}&l1_id=eq.{l1}&select=id,name")
        if not r2: return {"status": "denied", "reason": f"L2 {l2} not under L1 {l1}"}
        r3 = sb_get(f"l3_processes?id=eq.{l3}&l2_id=eq.{l2}&select=id,name")
        if not r3: return {"status": "denied", "reason": f"L3 {l3} not under L2 {l2}"}
        r4 = sb_get(f"l4_nodes?id=eq.{l4}&l3_id=eq.{l3}&select=id,name")
        if not r4: return {"status": "denied", "reason": f"L4 {l4} not under L3 {l3}"}
        return {"status": "allowed", "path": f"{r1[0]['name']} > {r2[0]['name']} > {r3[0]['name']} > {r4[0]['name']}"}
    except Exception as e:
        return {"status": "error", "reason": str(e)}


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_GET(self):
        if self.path == "/":
            self.respond(200, {
                "service": "SEOBAIKE Local Server",
                "microsoft": "Azure Functions (L1-L4 Pipeline + AI Router)",
                "nvidia": f"NIM ({len(MODELS)} models)",
                "supabase": "Tokyo DB",
                "patent": "115100981",
                "owner": "SEOBAIKE / Hsiao Chun-Hsiang",
                "endpoints": ["/health", "/models", "/l1", "/inference (POST)"]
            })
        elif self.path == "/health":
            self.respond(200, {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "patent": "115100981"})
        elif self.path == "/models":
            self.respond(200, {"models": MODELS, "provider": "NVIDIA NIM", "total": len(MODELS)})
        elif self.path == "/l1":
            try:
                data = sb_get("l1_categories?select=id,name&order=id&limit=50")
                self.respond(200, {"l1_categories": data, "count": len(data)})
            except Exception as e:
                self.respond(500, {"error": str(e)})
        elif self.path == "/providers":
            try:
                data = sb_get("ai_providers?select=name,is_active,is_online&order=name")
                self.respond(200, {"providers": data, "count": len(data)})
            except Exception as e:
                self.respond(500, {"error": str(e)})
        else:
            self.respond(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if self.path == "/inference":
            prompt = body.get("prompt", body.get("message", ""))
            model_key = body.get("model", "deepseek")
            model = MODELS.get(model_key, model_key)
            l1 = body.get("l1")
            l2 = body.get("l2")
            l3 = body.get("l3")
            l4 = body.get("l4")

            if not prompt:
                self.respond(400, {"error": "prompt is required"})
                return

            # L1-L4 check if provided
            path_result = None
            if l1 and l2 and l3 and l4:
                path_result = check_l1l4(l1, l2, l3, l4)
                if path_result["status"] != "allowed":
                    self.respond(403, {"error": "path_denied", "detail": path_result, "patent": "115100981"})
                    return

            # Call NVIDIA
            try:
                result = nv_chat(model, [{"role": "user", "content": prompt}])
                answer = result["choices"][0]["message"]["content"]
                self.respond(200, {
                    "answer": answer,
                    "model": model,
                    "provider": "NVIDIA NIM",
                    "path_check": path_result,
                    "patent": "115100981",
                    "owner": "SEOBAIKE"
                })
            except Exception as e:
                self.respond(500, {"error": str(e)})
        else:
            self.respond(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"""
============================================================
  SEOBAIKE LOCAL SERVER
  Microsoft Azure + NVIDIA NIM + Supabase
============================================================
  http://localhost:{PORT}

  GET  /          - Server info
  GET  /health    - Health check
  GET  /models    - NVIDIA models
  GET  /l1        - Patent L1 categories
  GET  /providers - AI providers
  POST /inference - AI inference (NVIDIA)
       body: {{"prompt": "...", "model": "deepseek"}}
============================================================
  Patent: 115100981 | Owner: SEOBAIKE
  Press Ctrl+C to stop
============================================================
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
