@echo off
chcp 65001 >nul
set AZ="C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

echo === SEOBAIKE Azure Deploy ===
echo.

echo [0] Set subscription...
call %AZ% account set --subscription "fca96658-74df-4d3e-9212-aade3e98ca1f"

echo [3.1] Key Vault RBAC fix...
call %AZ% role assignment create --role "Key Vault Secrets Officer" --assignee "fb5e8f9f-340e-4c4d-bc69-a21bb6887d2d" --scope "/subscriptions/fca96658-74df-4d3e-9212-aade3e98ca1f/resourceGroups/seobaike-rg/providers/Microsoft.KeyVault/vaults/seobaike-vault" -o json

echo [3.2] Store NVIDIA key in Vault...
call %AZ% keyvault secret set --vault-name "seobaike-vault" --name "nvidia-api-key" --value "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" --query "{name:name}" -o json

echo [4] Azure Functions - L1-L4 Pipeline...
call %AZ% functionapp create --name "seobaike-l1l4-pipeline" --resource-group "seobaike-rg" --storage-account "seobaikestorage" --consumption-plan-location "japaneast" --runtime "python" --runtime-version "3.11" --functions-version 4 --os-type "linux" --query "{name:name,state:state}" -o json

echo [5] Azure Functions - AI Router...
call %AZ% functionapp create --name "seobaike-ai-router" --resource-group "seobaike-rg" --storage-account "seobaikestorage" --consumption-plan-location "japaneast" --runtime "python" --runtime-version "3.11" --functions-version 4 --os-type "linux" --query "{name:name,state:state}" -o json

echo [6] API Management (Consumption tier)...
call %AZ% apim create --name "seobaike-apim" --resource-group "seobaike-rg" --location "japaneast" --publisher-name "SEOBAIKE" --publisher-email "icanforyouthebest@gmail.com" --sku-name "Consumption" --no-wait --query "{name:name}" -o json

echo [7] Enable Managed Identity on both Functions...
call %AZ% functionapp identity assign --name "seobaike-l1l4-pipeline" --resource-group "seobaike-rg" --query "{principalId:principalId}" -o json
call %AZ% functionapp identity assign --name "seobaike-ai-router" --resource-group "seobaike-rg" --query "{principalId:principalId}" -o json

echo.
echo === DONE ===
echo Entra ID App: a5775f43-e106-4fa5-828c-d02c7e24a51a
echo Resource Group: seobaike-rg (japaneast)
echo Key Vault: seobaike-vault
echo Pipeline: seobaike-l1l4-pipeline
echo Router: seobaike-ai-router
echo APIM: seobaike-apim
