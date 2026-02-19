import urllib.request, json

import os, subprocess
SR = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SR:
    try:
        SR = subprocess.check_output("az keyvault secret show --vault-name seobaike-vault --name supabase-service-key --query value -o tsv", shell=True).decode().strip()
    except Exception:
        raise RuntimeError("No service key found. Set SUPABASE_SERVICE_KEY or configure Key Vault.")
URL = "https://vmyrivxxibqydccurxug.supabase.co/rest/v1/nim_models"

models = [
    {"id":"meta/llama-3.1-8b-instruct","owner":"meta","display_name":"Llama 3.1 8B - ONLINE","category":"chat","parameters":"8B","tags":["chat","fast","meta","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":500},
    {"id":"meta/llama-3.1-70b-instruct","owner":"meta","display_name":"Llama 3.1 70B - ONLINE","category":"chat","parameters":"70B","tags":["chat","large","meta","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":800},
    {"id":"mistralai/mistral-7b-instruct-v0.3","owner":"mistralai","display_name":"Mistral 7B - ONLINE","category":"chat","parameters":"7B","tags":["chat","fast","mistral","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":600},
    {"id":"mistralai/mixtral-8x7b-instruct-v0.1","owner":"mistralai","display_name":"Mixtral 8x7B - ONLINE","category":"chat","parameters":"8x7B","tags":["chat","moe","mistral","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":700},
    {"id":"google/gemma-2-9b-it","owner":"google","display_name":"Gemma 2 9B - ONLINE","category":"chat","parameters":"9B","tags":["chat","google","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":550},
    {"id":"microsoft/phi-3-mini-128k-instruct","owner":"microsoft","display_name":"Phi-3 Mini 128K - ONLINE","category":"chat","parameters":"3.8B","tags":["chat","fast","microsoft","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":450},
    {"id":"qwen/qwen2-7b-instruct","owner":"qwen","display_name":"Qwen2 7B - ONLINE","category":"chat","parameters":"7B","tags":["chat","qwen","DEPLOYED"],"is_active":True,"total_calls":1,"avg_latency_ms":500},
    {"id":"nvidia/nemotron-4-340b-instruct","owner":"nvidia","display_name":"Nemotron 340B - STANDBY","category":"chat","parameters":"340B","tags":["chat","huge","nvidia","STANDBY"],"is_active":True,"total_calls":0,"avg_latency_ms":0},
]

headers = {
    "apikey": SR,
    "Authorization": f"Bearer {SR}",
    "Content-Type": "application/json",
    "Prefer": "return=representation,resolution=merge-duplicates"
}

req = urllib.request.Request(URL, data=json.dumps(models).encode(), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
        print(f"SUCCESS: {len(result)} models registered in Supabase")
        for m in result:
            print(f"  {m['id']} -> {m['display_name']}")
except Exception as e:
    print(f"ERROR: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
