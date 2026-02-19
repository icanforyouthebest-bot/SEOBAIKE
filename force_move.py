import requests
import sys
import subprocess
sys.stdout.reconfigure(encoding='utf-8')

key = subprocess.check_output('az keyvault secret show --vault-name seobaike-vault --name nvidia-api-key --query value -o tsv', shell=True).decode().strip()

url = "https://integrate.api.nvidia.com/v1/chat/completions"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
payload = {
    "model": "meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "老闆今天要看到證據，給我一個機械臂力回饋的實體動作描述"}],
    "max_tokens": 100
}

resp = requests.post(url, headers=headers, json=payload)
print("生成結果：", resp.json()["choices"][0]["message"]["content"])
