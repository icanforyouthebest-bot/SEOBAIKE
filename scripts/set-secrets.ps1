# One-time script to set Azure SP credentials as GitHub Secrets
# Usage: set APP_ID, PASSWORD, TENANT, SUB then run this script
# Secrets are stored in GitHub Actions, not here.

$GH = "C:\Program Files\GitHub CLI\gh.exe"
$REPO = "icanforyouthebest-bot/SEOBAIKE"
$APP_ID = $env:AZURE_CLIENT_ID
$PASSWORD = $env:AZURE_CLIENT_SECRET
$TENANT = "daea71db-b115-4dea-8b51-1b0757fee4b9"
$SUB = "fca96658-74df-4d3e-9212-aade3e98ca1f"

$CREDS = '{"clientId":"' + $APP_ID + '","clientSecret":"' + $PASSWORD + '","subscriptionId":"' + $SUB + '","tenantId":"' + $TENANT + '"}'

$CREDS    | & $GH secret set AZURE_CREDENTIALS     --repo $REPO; Write-Host "OK AZURE_CREDENTIALS"
$APP_ID   | & $GH secret set CLIENT_ID             --repo $REPO; Write-Host "OK CLIENT_ID"
$PASSWORD | & $GH secret set CLIENT_SECRET         --repo $REPO; Write-Host "OK CLIENT_SECRET"
$TENANT   | & $GH secret set TENANT_ID             --repo $REPO; Write-Host "OK TENANT_ID"
$TENANT   | & $GH secret set AZURE_TENANT_ID       --repo $REPO; Write-Host "OK AZURE_TENANT_ID"
$SUB      | & $GH secret set AZURE_SUBSCRIPTION_ID --repo $REPO; Write-Host "OK AZURE_SUBSCRIPTION_ID"

Write-Host "=== DONE ==="
