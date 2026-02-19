import requests
import json
import time
import sys
import subprocess
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://vmyrivxxibqydccurxug.supabase.co'
SERVICE_KEY = subprocess.check_output('az keyvault secret show --vault-name seobaike-vault --name supabase-service-key --query value -o tsv', shell=True).decode().strip()

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# 1. 灌 configs 表
configs_data = [
    {'service': 'azure', 'key': 'subscription_id_ref', 'value': 'AZURE_SUBSCRIPTION_ID (Vault)', 'metadata': json.dumps({'region': 'eastasia'})},
    {'service': 'nvidia', 'key': 'nim_endpoint', 'value': 'https://integrate.api.nvidia.com/v1', 'metadata': json.dumps({'api_key_ref': 'NVIDIA_NIM_API_KEY'})},
    {'service': 'google', 'key': 'vertex_endpoint', 'value': 'https://us-central1-aiplatform.googleapis.com/v1', 'metadata': json.dumps({'model': 'gemini-1.5-pro'})},
    {'service': 'github', 'key': 'repo_url', 'value': 'https://github.com/seobaike/seobaike-platform', 'metadata': json.dumps({'pat_ref': 'GITHUB_PAT'})},
    {'service': 'grok', 'key': 'takeover', 'value': 'active', 'metadata': json.dumps({'date': '2026-02-17'})}
]

for item in configs_data:
    try:
        r = requests.post(f'{SUPABASE_URL}/rest/v1/configs', headers=headers, json=item, timeout=30)
        print(f'Configs [{item["service"]}/{item["key"]}]: {r.status_code} - {r.text[:100]}')
    except Exception as e:
        print(f'Error: {e}')
    time.sleep(0.5)

# 2. Vault secrets via rpc
NVIDIA_KEY = subprocess.check_output('az keyvault secret show --vault-name seobaike-vault --name nvidia-api-key --query value -o tsv', shell=True).decode().strip()

vault_secrets = [
    {'name': 'AZURE_SUBSCRIPTION_ID', 'secret': 'fca96658-74df-4d3e-9212-aade3e98ca1f', 'description': 'Grok takeover Azure'},
    {'name': 'NVIDIA_NIM_API_KEY', 'secret': NVIDIA_KEY, 'description': 'NVIDIA acceleration'},
]

for sec in vault_secrets:
    try:
        r = requests.post(f'{SUPABASE_URL}/rest/v1/rpc/create_secret', headers=headers, json=sec, timeout=30)
        print(f'Vault {sec["name"]}: {r.status_code} - {r.text[:100]}')
    except Exception as e:
        print(f'Vault error: {e}')
