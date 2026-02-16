#!/bin/bash
# ===================================================================
# SEOBAIKE Azure 全套部署腳本
# 專利 115100981 — 小路光有限公司
#
# 架構：Entra ID → APIM → Azure Functions → AI Models
# 所有輸入 → 先進微軟 → 再進模型 → 再回微軟 → 再回使用者
# ===================================================================

set -e

# === 變數 ===
RESOURCE_GROUP="seobaike-rg"
LOCATION="japaneast"  # 東京區域（與 Supabase 同區）
SUBSCRIPTION=""  # 填入 Azure Subscription ID

FUNC_APP_PIPELINE="seobaike-l1l4-pipeline"
FUNC_APP_ROUTER="seobaike-ai-router"
APIM_NAME="seobaike-apim"
STORAGE_ACCOUNT="seobaikestorage"
APP_INSIGHTS="seobaike-insights"
KEYVAULT_NAME="seobaike-vault"

echo "=== SEOBAIKE Azure 部署開始 ==="
echo ""

# === Step 0: 登入 ===
echo "[0/7] Azure 登入..."
az login --use-device-code 2>/dev/null || az login
if [ -n "$SUBSCRIPTION" ]; then
    az account set --subscription "$SUBSCRIPTION"
fi
echo "      已登入: $(az account show --query name -o tsv)"

# === Step 1: Entra ID App Registration ===
echo ""
echo "[1/7] 建立 Microsoft Entra ID App Registration..."
APP_ID=$(az ad app create \
    --display-name "SEOBAIKE-AI-Platform" \
    --sign-in-audience "AzureADMyOrg" \
    --query appId -o tsv)

# 建立 Service Principal
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv 2>/dev/null || echo "exists")

# 設定 App Roles
az ad app update --id "$APP_ID" --app-roles @entra-config/app-registration.json 2>/dev/null || true

echo "      App ID: $APP_ID"
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "      Tenant ID: $TENANT_ID"

# === Step 2: Resource Group + Storage ===
echo ""
echo "[2/7] 建立資源群組 + 儲存帳戶..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none
az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    -o none 2>/dev/null || echo "      Storage already exists"

# Application Insights
az monitor app-insights component create \
    --app "$APP_INSIGHTS" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    -o none 2>/dev/null || echo "      App Insights already exists"

echo "      Resource Group: $RESOURCE_GROUP ($LOCATION)"

# === Step 3: Azure Key Vault（管理所有 API Keys） ===
echo ""
echo "[3/7] 建立 Azure Key Vault..."
az keyvault create \
    --name "$KEYVAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku standard \
    -o none 2>/dev/null || echo "      Key Vault already exists"

echo "      Key Vault: $KEYVAULT_NAME"
echo "      (API Keys 將從 Key Vault 讀取，模型本身不持有)"

# === Step 4: Azure Functions — L1→L4 Pipeline ===
echo ""
echo "[4/7] 部署 Azure Functions — L1→L4 Pipeline..."
az functionapp create \
    --name "$FUNC_APP_PIPELINE" \
    --resource-group "$RESOURCE_GROUP" \
    --storage-account "$STORAGE_ACCOUNT" \
    --consumption-plan-location "$LOCATION" \
    --runtime python \
    --runtime-version 3.11 \
    --functions-version 4 \
    --os-type linux \
    -o none 2>/dev/null || echo "      Function App already exists"

# 設定環境變數
az functionapp config appsettings set \
    --name "$FUNC_APP_PIPELINE" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        SUPABASE_URL="https://vmyrivxxibqydccurxug.supabase.co" \
        AI_ROUTER_URL="https://$FUNC_APP_ROUTER.azurewebsites.net/api/route" \
    -o none

# 啟用 Key Vault Reference
az functionapp identity assign \
    --name "$FUNC_APP_PIPELINE" \
    --resource-group "$RESOURCE_GROUP" \
    -o none

echo "      Pipeline: $FUNC_APP_PIPELINE.azurewebsites.net"

# === Step 5: Azure Functions — AI Router ===
echo ""
echo "[5/7] 部署 Azure Functions — AI Router..."
az functionapp create \
    --name "$FUNC_APP_ROUTER" \
    --resource-group "$RESOURCE_GROUP" \
    --storage-account "$STORAGE_ACCOUNT" \
    --consumption-plan-location "$LOCATION" \
    --runtime python \
    --runtime-version 3.11 \
    --functions-version 4 \
    --os-type linux \
    -o none 2>/dev/null || echo "      Function App already exists"

# 啟用 Managed Identity
az functionapp identity assign \
    --name "$FUNC_APP_ROUTER" \
    --resource-group "$RESOURCE_GROUP" \
    -o none

echo "      Router: $FUNC_APP_ROUTER.azurewebsites.net"

# === Step 6: Azure API Management ===
echo ""
echo "[6/7] 建立 Azure API Management（需要 15-45 分鐘）..."
az apim create \
    --name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --publisher-name "SEOBAIKE / 小路光有限公司" \
    --publisher-email "boss@aiforseo.vip" \
    --sku-name Consumption \
    --no-wait \
    -o none 2>/dev/null || echo "      APIM already exists"

echo "      APIM: $APIM_NAME.azure-api.net (建立中...)"

# === Step 7: 上傳規則檔到 SharePoint/OneDrive ===
echo ""
echo "[7/7] 準備規則檔..."
echo "      authority-rules.json — 權威規則"
echo "      app-registration.json — Entra ID 設定"
echo "      ai-router-policy.xml — APIM 政策"
echo "      bot-config.json — Copilot Studio 設定"
echo ""
echo "      ※ 請手動上傳到 OneDrive/SharePoint:"
echo "      OneDrive > SEOBAIKE > Rules/"

# === 完成 ===
echo ""
echo "=========================================="
echo "  SEOBAIKE Azure 部署完成"
echo "=========================================="
echo ""
echo "  Entra ID App:  $APP_ID"
echo "  Tenant ID:     $TENANT_ID"
echo "  Pipeline:      https://$FUNC_APP_PIPELINE.azurewebsites.net"
echo "  AI Router:     https://$FUNC_APP_ROUTER.azurewebsites.net"
echo "  APIM:          https://$APIM_NAME.azure-api.net"
echo "  Key Vault:     https://$KEYVAULT_NAME.vault.azure.net"
echo ""
echo "  流程："
echo "  Input → Copilot Studio → APIM(Entra驗證)"
echo "  → Pipeline(L1→L4) → Router → Model → 回傳"
echo ""
echo "  專利 115100981 — 小路光有限公司"
echo "=========================================="
