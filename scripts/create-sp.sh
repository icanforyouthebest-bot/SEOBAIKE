#!/bin/bash
set -e

SUB="fca96658-74df-4d3e-9212-aade3e98ca1f"
RG="seobaike-rg"
NAME="seobaike-ci-sp"
REPO="icanforyouthebest-bot/SEOBAIKE"
GH_TOKEN="${GH_TOKEN:-}"  # set via: export GH_TOKEN=...

echo "=== Creating Service Principal: $NAME ==="
JSON=$(az ad sp create-for-rbac \
  --name "$NAME" \
  --role Contributor \
  --scopes "/subscriptions/$SUB/resourceGroups/$RG" \
  --output json)

APP_ID=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
PASSWORD=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
TENANT=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['tenant'])")

echo "  appId:  $APP_ID"
echo "  tenant: $TENANT"

echo ""
echo "=== Assigning Reader on subscription ==="
az role assignment create \
  --assignee "$APP_ID" \
  --role Reader \
  --scope "/subscriptions/$SUB" \
  --output none && echo "  Reader: OK"

echo ""
echo "=== Setting GitHub Secrets ==="
export GH_TOKEN

CREDS=$(printf '{"clientId":"%s","clientSecret":"%s","subscriptionId":"%s","tenantId":"%s"}' \
  "$APP_ID" "$PASSWORD" "$SUB" "$TENANT")

echo "$CREDS"           | gh secret set AZURE_CREDENTIALS --repo "$REPO"
echo "$APP_ID"          | gh secret set CLIENT_ID         --repo "$REPO"
echo "$PASSWORD"        | gh secret set CLIENT_SECRET     --repo "$REPO"
echo "$TENANT"          | gh secret set TENANT_ID         --repo "$REPO"
echo "$TENANT"          | gh secret set AZURE_TENANT_ID   --repo "$REPO"
echo "$SUB"             | gh secret set AZURE_SUBSCRIPTION_ID --repo "$REPO"

echo ""
echo "=== DONE ==="
echo "appId=$APP_ID"
echo "tenant=$TENANT"
