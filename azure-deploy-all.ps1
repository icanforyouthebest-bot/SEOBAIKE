$AZ = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Host "=== SEOBAIKE Azure Deploy ===" -ForegroundColor Green

Write-Host "[0] Set subscription..."
& $AZ account set --subscription "fca96658-74df-4d3e-9212-aade3e98ca1f"

Write-Host "[3.1] Key Vault RBAC fix..."
& $AZ role assignment create --role "Key Vault Secrets Officer" --assignee "fb5e8f9f-340e-4c4d-bc69-a21bb6887d2d" --scope "/subscriptions/fca96658-74df-4d3e-9212-aade3e98ca1f/resourceGroups/seobaike-rg/providers/Microsoft.KeyVault/vaults/seobaike-vault" -o json

Write-Host "[3.2] Store NVIDIA key..."
& $AZ keyvault secret set --vault-name "seobaike-vault" --name "nvidia-api-key" --value "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" -o json

Write-Host "[4] Azure Functions - L1-L4 Pipeline..."
& $AZ functionapp create --name "seobaike-l1l4-pipeline" --resource-group "seobaike-rg" --storage-account "seobaikestorage" --consumption-plan-location "japaneast" --runtime "python" --runtime-version "3.11" --functions-version 4 --os-type "linux" -o json

Write-Host "[5] Azure Functions - AI Router..."
& $AZ functionapp create --name "seobaike-ai-router" --resource-group "seobaike-rg" --storage-account "seobaikestorage" --consumption-plan-location "japaneast" --runtime "python" --runtime-version "3.11" --functions-version 4 --os-type "linux" -o json

Write-Host "[6] API Management..."
& $AZ apim create --name "seobaike-apim" --resource-group "seobaike-rg" --location "japaneast" --publisher-name "SEOBAIKE" --publisher-email "icanforyouthebest@gmail.com" --sku-name "Consumption" --no-wait -o json

Write-Host "[7] Managed Identity..."
& $AZ functionapp identity assign --name "seobaike-l1l4-pipeline" --resource-group "seobaike-rg" -o json
& $AZ functionapp identity assign --name "seobaike-ai-router" --resource-group "seobaike-rg" -o json

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
