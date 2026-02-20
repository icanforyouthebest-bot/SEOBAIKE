"""
AI Empire — SEOBAIKE 完整歸檔腳本
目標：把所有東西歸檔到 Azure Blob Storage + E5 OneDrive
"""
import os, sys, json, zipfile, datetime, requests, subprocess
from pathlib import Path

# ── 設定 ──────────────────────────────────────────────────────────
REPO_ROOT       = Path(r"C:\SEOBAIKE")
CONN_STR        = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
STORAGE_ACCOUNT = "seobaikestorage"
CONTAINER_FULL  = "seobaike-full"
CONTAINER_ARCH  = "archive"
GRAPH_URL       = "https://graph.microsoft.com/v1.0"
TENANT_E5       = "c1e1278e-c05c-4d00-a4c9-93fbbea01346"
CLIENT_ID_E5    = "9dc16b16-952d-4190-b626-692c26f9262e"
CLIENT_SECRET_E5= os.environ.get("E5_CLIENT_SECRET", "")
GH              = r"C:\Program Files\GitHub CLI\gh.exe"
REPO_GH         = "icanforyouthebest-bot/SEOBAIKE"

EXCLUDE_DIRS  = {".git", "node_modules", "__pycache__", ".next", "dist", ".turbo", "build", ".cache"}
EXCLUDE_EXTS  = {".pyc", ".pyo", ".log"}
NOW           = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")

# ── Step 1: 建立 ZIP ───────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"[1] 打包專案 ZIP…")
zip_path = Path(r"C:\Temp") / f"seobaike-full-{NOW}.zip"
zip_path.parent.mkdir(exist_ok=True)

file_count = 0
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for f in REPO_ROOT.rglob("*"):
        if any(part in EXCLUDE_DIRS for part in f.parts):
            continue
        if f.suffix in EXCLUDE_EXTS:
            continue
        if f.is_file():
            arcname = f.relative_to(REPO_ROOT.parent)
            zf.write(f, arcname)
            file_count += 1

zip_size_mb = zip_path.stat().st_size / 1024 / 1024
print(f"  ZIP: {zip_path.name}  ({file_count} files, {zip_size_mb:.1f} MB)")

# ── Step 2: 建立 Manifest ─────────────────────────────────────────
print(f"\n[2] 生成完整 Manifest…")

# GitHub Secrets list
gh_secrets = []
try:
    r = subprocess.run([GH, "secret", "list", "--repo", REPO_GH, "--json", "name,updatedAt"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        gh_secrets = json.loads(r.stdout)
except Exception as e:
    print(f"  GH secrets list error: {e}")

# Azure resources
az_resources = []
try:
    r = subprocess.run(
        ["powershell.exe", "-Command",
         "az resource list --resource-group seobaike-rg --output json"],
        capture_output=True, text=True)
    if r.returncode == 0:
        az_resources = json.loads(r.stdout)
except Exception as e:
    print(f"  AZ resources error: {e}")

# Azure role assignments for SP
az_roles = []
try:
    r = subprocess.run(
        ["powershell.exe", "-Command",
         "az role assignment list --assignee 126182e4-4670-4314-b0ed-21f34d677f97 --output json"],
        capture_output=True, text=True)
    if r.returncode == 0:
        az_roles = json.loads(r.stdout)
except Exception as e:
    print(f"  AZ roles error: {e}")

# Recent CI runs
ci_runs = []
try:
    r = subprocess.run([GH, "run", "list", "--repo", REPO_GH, "--limit", "10",
                        "--json", "status,conclusion,name,createdAt,workflowName"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        ci_runs = json.loads(r.stdout)
except Exception as e:
    print(f"  CI runs error: {e}")

# File tree (top level)
file_tree = {}
for p in sorted(REPO_ROOT.rglob("*")):
    if any(part in EXCLUDE_DIRS for part in p.parts):
        continue
    if p.is_file():
        rel = str(p.relative_to(REPO_ROOT))
        parts = rel.split(os.sep)
        d = file_tree
        for part in parts[:-1]:
            d = d.setdefault(part, {})
        d[parts[-1]] = p.stat().st_size

manifest = {
    "generated_at": NOW,
    "archive_version": f"seobaike-{NOW}",
    "project": "SEOBAIKE / AI Empire",
    "repository": f"https://github.com/{REPO_GH}",
    "zip_file": zip_path.name,
    "zip_files": file_count,
    "zip_size_mb": round(zip_size_mb, 2),
    "services": {
        "cloudflare_worker": "seobaike-remote-control",
        "azure_functions": {
            "l1l4_pipeline": "seobaike-l1l4-pipeline.azurewebsites.net",
            "ai_router": "seobaike-ai-router.azurewebsites.net"
        },
        "supabase_project": "tjpamxtqfzztqnrbfkzn",
        "apim": "seobaike-apim.azure-api.net",
        "key_vault": "seobaike-vault",
        "storage_account": "seobaikestorage",
        "cloudflare_zone": "aiforseo.vip"
    },
    "azure": {
        "subscription_id": "fca96658-74df-4d3e-9212-aade3e98ca1f",
        "tenant_id": "daea71db-b115-4dea-8b51-1b0757fee4b9",
        "resource_group": "seobaike-rg",
        "service_principal": {
            "app_id": "126182e4-4670-4314-b0ed-21f34d677f97",
            "display_name": "seobaike-ci-sp",
            "roles": ["Reader (subscription)", "Contributor (seobaike-rg)"]
        },
        "resources": [{"name": r.get("name"), "type": r.get("type"), "location": r.get("location")}
                      for r in az_resources]
    },
    "e5": {
        "tenant_id": TENANT_E5,
        "tenant_domain": "AIEmpire.onmicrosoft.com",
        "e5_automation_app": CLIENT_ID_E5
    },
    "github_secrets": [{"name": s["name"], "updated_at": s.get("updatedAt", "")} for s in gh_secrets],
    "github_secrets_count": len(gh_secrets),
    "recent_ci_runs": ci_runs[:10],
    "file_tree": file_tree
}

manifest_path = Path(r"C:\Temp") / f"seobaike-manifest-{NOW}.json"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  Manifest: {manifest_path.name} ({len(gh_secrets)} secrets, {len(az_resources)} Azure resources)")

# ── Step 3: Upload to Azure Blob ──────────────────────────────────
print(f"\n[3] 上傳到 Azure Blob Storage (seobaikestorage)…")

try:
    from azure.storage.blob import BlobServiceClient, ContentSettings
    svc = BlobServiceClient.from_connection_string(CONN_STR)

    # Upload ZIP to seobaike-full
    blob_zip = svc.get_blob_client(CONTAINER_FULL, f"seobaike-full-{NOW}.zip")
    with open(zip_path, "rb") as f:
        blob_zip.upload_blob(f, overwrite=True,
                             content_settings=ContentSettings(content_type="application/zip"))
    print(f"  [Azure Blob] ZIP OK → {CONTAINER_FULL}/seobaike-full-{NOW}.zip")

    # Upload manifest to seobaike-full
    blob_mf = svc.get_blob_client(CONTAINER_FULL, f"seobaike-manifest-{NOW}.json")
    blob_mf.upload_blob(manifest_path.read_bytes(), overwrite=True,
                        content_settings=ContentSettings(content_type="application/json"))
    print(f"  [Azure Blob] Manifest OK → {CONTAINER_FULL}/seobaike-manifest-{NOW}.json")

    # Also upload manifest to archive container (indexed by date)
    blob_arch = svc.get_blob_client(CONTAINER_ARCH, f"manifest/{NOW}/manifest.json")
    blob_arch.upload_blob(manifest_path.read_bytes(), overwrite=True,
                          content_settings=ContentSettings(content_type="application/json"))
    print(f"  [Azure Blob] Manifest OK → {CONTAINER_ARCH}/manifest/{NOW}/manifest.json")

except ImportError:
    print("  azure-storage-blob not installed.")
    print("  Please install: pip install azure-storage-blob")

# ── Step 4: E5 OneDrive ───────────────────────────────────────────
print(f"\n[4] 上傳到 E5 OneDrive (AIEmpire.onmicrosoft.com)…")

def get_e5_token():
    if not CLIENT_SECRET_E5:
        return None
    try:
        from msal import ConfidentialClientApplication
        app = ConfidentialClientApplication(
            CLIENT_ID_E5,
            authority=f"https://login.microsoftonline.com/{TENANT_E5}",
            client_credential=CLIENT_SECRET_E5
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        return result.get("access_token")
    except Exception as e:
        print(f"  [E5] Token error: {e}")
        return None

token = get_e5_token()
if not token:
    # Try with az account token for c1e1278e tenant
    try:
        r = subprocess.run(
            ["powershell.exe", "-Command",
             f"az account get-access-token --tenant {TENANT_E5} --resource https://graph.microsoft.com --output json"],
            capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            token = json.loads(r.stdout).get("accessToken")
            print(f"  [E5] Got token via az account (delegated)")
    except Exception as e:
        print(f"  [E5] az token error: {e}")

if token:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Try upload manifest to OneDrive
    for upn in ["HsuChunHsiang@AIEmpire.onmicrosoft.com", "admin@AIEmpire.onmicrosoft.com"]:
        url = f"{GRAPH_URL}/users/{upn}/drive/root:/SEOBAIKE/archive/{NOW}/manifest.json:/content"
        r = requests.put(url, headers={**headers, "Content-Type": "application/json"},
                         data=manifest_path.read_bytes(), timeout=30)
        if r.status_code in (200, 201):
            print(f"  [E5] Manifest OK → OneDrive/{upn}/SEOBAIKE/archive/{NOW}/manifest.json")

            # Also upload ZIP (if < 100MB, otherwise use upload session)
            if zip_size_mb < 100:
                url2 = f"{GRAPH_URL}/users/{upn}/drive/root:/SEOBAIKE/archive/{NOW}/{zip_path.name}:/content"
                with open(zip_path, "rb") as zf:
                    r2 = requests.put(url2, headers={**headers, "Content-Type": "application/zip"},
                                      data=zf, timeout=120)
                if r2.status_code in (200, 201):
                    print(f"  [E5] ZIP OK → OneDrive/{upn}/SEOBAIKE/archive/{NOW}/{zip_path.name}")
                else:
                    print(f"  [E5] ZIP upload HTTP {r2.status_code}")
            break
        else:
            print(f"  [E5] {upn}: HTTP {r.status_code} {r.text[:60]}")
else:
    print("  [E5] No E5 token available — set E5_CLIENT_SECRET env var to enable E5 upload")
    print(f"  [E5] Skipped (Azure Blob archive is complete)")

# ── Summary ───────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"歸檔完成 {NOW}")
print(f"  ZIP  : https://seobaikestorage.blob.core.windows.net/{CONTAINER_FULL}/seobaike-full-{NOW}.zip")
print(f"  JSON : https://seobaikestorage.blob.core.windows.net/{CONTAINER_FULL}/seobaike-manifest-{NOW}.json")
print(f"  Files: {file_count} | Size: {zip_size_mb:.1f} MB")
print(f"  Secrets: {len(gh_secrets)} | Azure resources: {len(az_resources)}")
print(f"{'='*60}")
