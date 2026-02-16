@echo off
call "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account set --subscription "fca96658-74df-4d3e-9212-aade3e98ca1f"
call "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" role assignment create --role "Key Vault Secrets Officer" --assignee "fb5e8f9f-340e-4c4d-bc69-a21bb6887d2d" --scope "/subscriptions/fca96658-74df-4d3e-9212-aade3e98ca1f/resourceGroups/seobaike-rg/providers/Microsoft.KeyVault/vaults/seobaike-vault" -o json
