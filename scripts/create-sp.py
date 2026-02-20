"""
One-time SP creation script for tenant daea71db (icanforyouthebestgmail.onmicrosoft.com)
"""
import requests, json, time, uuid, subprocess, sys

CLIENT_ID_PUB = '1950a258-227b-4e31-a9cf-717495945fc2'  # Azure PowerShell public client
TENANT        = 'daea71db-b115-4dea-8b51-1b0757fee4b9'
SUBSCRIPTION  = 'fca96658-74df-4d3e-9212-aade3e98ca1f'
REPO          = 'icanforyouthebest-bot/SEOBAIKE'

def get_token(scope, grant_type='device_code', **kwargs):
    return requests.post(
        f'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token',
        data={'client_id': CLIENT_ID_PUB, 'grant_type': grant_type, 'scope': scope, **kwargs},
        timeout=15)

# ── Step 0: Device code login ──────────────────────────────────────────────
print('=' * 60)
r = requests.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    data={'client_id': CLIENT_ID_PUB, 'scope': 'https://management.azure.com/user_impersonation offline_access'},
    timeout=15)

if not r.ok:
    print(f'Device code error: {r.status_code} {r.text[:200]}')
    sys.exit(1)

d = r.json()
device_code   = d['device_code']
user_code     = d['user_code']
interval      = d.get('interval', 5)
expires_in    = d.get('expires_in', 900)

print(f'  URL  : https://microsoft.com/devicelogin')
print(f'  Code : {user_code}')
print(f'  Login: icanforyouthebestgmail.onmicrosoft.com admin account')
print('=' * 60)
print('Polling...')

arm_token = refresh_token = None
for i in range(int(expires_in / interval)):
    time.sleep(interval)
    tr = get_token(
        scope='https://management.azure.com/user_impersonation offline_access',
        grant_type='urn:ietf:params:oauth:grant-type:device_code',
        device_code=device_code)
    td = tr.json()
    if 'access_token' in td:
        arm_token     = td['access_token']
        refresh_token = td.get('refresh_token', '')
        print(f'  [OK] ARM token acquired')
        break
    if td.get('error') == 'authorization_pending':
        print(f'  [{i+1}] Waiting...')
        continue
    print(f'  Error: {td}')
    sys.exit(1)

if not arm_token:
    print('Timed out.')
    sys.exit(1)

# Get Graph token via refresh token
print('Getting Graph token...')
graph_token = arm_token
if refresh_token:
    gr = requests.post(
        f'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token',
        data={'client_id': CLIENT_ID_PUB, 'grant_type': 'refresh_token',
              'refresh_token': refresh_token, 'scope': 'https://graph.microsoft.com/.default'},
        timeout=15)
    if gr.ok and 'access_token' in gr.json():
        graph_token = gr.json()['access_token']
        print('  [OK] Graph token acquired')

arm_h   = {'Authorization': f'Bearer {arm_token}',   'Content-Type': 'application/json'}
graph_h = {'Authorization': f'Bearer {graph_token}', 'Content-Type': 'application/json'}

# ── Step 1: Create App Registration ───────────────────────────────────────
print('\n[1] Creating App Registration: seobaike-ci-sp ...')
graph_perms = [
    ('df021288-bdef-4463-88db-98f22de89214', 'User.Read.All'),
    ('b0afded3-3588-46d8-8b3d-9842eff778da', 'AuditLog.Read.All'),
    ('246dd0d5-5bd0-4def-940b-0421030a5b68', 'Policy.Read.All'),
    ('dc5007c0-2d7d-4c42-879c-2dab87571379', 'IdentityRiskyUser.Read.All'),
    ('9492366f-7969-46a4-8d15-ed1a20078fff', 'Sites.Read.All'),
    ('01d4889c-1287-42c6-ac1f-5d1e02578ef6', 'Files.ReadWrite.All'),
    ('62a82d76-70ea-41e2-9197-370581804d09', 'Group.ReadWrite.All'),
]

app_r = requests.post('https://graph.microsoft.com/v1.0/applications', headers=graph_h, json={
    'displayName': 'seobaike-ci-sp',
    'signInAudience': 'AzureADMyOrg',
    'requiredResourceAccess': [{
        'resourceAppId': '00000003-0000-0000-c000-000000000000',
        'resourceAccess': [{'id': rid, 'type': 'Role'} for rid, _ in graph_perms]
    }]
}, timeout=20)

if not app_r.ok:
    print(f'  FAIL: {app_r.status_code} {app_r.text[:300]}')
    sys.exit(1)

app        = app_r.json()
app_id     = app['appId']
app_obj_id = app['id']
print(f'  appId: {app_id}')

# ── Step 2: Create Service Principal ──────────────────────────────────────
print('\n[2] Creating Service Principal...')
sp_r = requests.post('https://graph.microsoft.com/v1.0/servicePrincipals',
    headers=graph_h, json={'appId': app_id}, timeout=15)
if not sp_r.ok:
    print(f'  FAIL: {sp_r.status_code} {sp_r.text[:300]}')
    sys.exit(1)
sp_obj_id = sp_r.json()['id']
print(f'  objectId: {sp_obj_id}')

# ── Step 3: Create Client Secret ──────────────────────────────────────────
print('\n[3] Creating client secret...')
sec_r = requests.post(
    f'https://graph.microsoft.com/v1.0/applications/{app_obj_id}/addPassword',
    headers=graph_h,
    json={'passwordCredential': {'displayName': 'seobaike-ci', 'endDateTime': '2028-12-31T00:00:00Z'}},
    timeout=15)
if not sec_r.ok:
    print(f'  FAIL: {sec_r.status_code} {sec_r.text[:300]}')
    sys.exit(1)
client_secret = sec_r.json()['secretText']
print(f'  Secret: {client_secret[:12]}... OK')

# ── Step 4: Reader on Subscription ────────────────────────────────────────
print('\n[4] Assigning Reader on subscription...')
READER = f'/subscriptions/{SUBSCRIPTION}/providers/Microsoft.Authorization/roleDefinitions/acdd72a7-3385-48ef-bd42-f606fba81ae7'
ra = requests.put(
    f'https://management.azure.com/subscriptions/{SUBSCRIPTION}/providers/Microsoft.Authorization/roleAssignments/{uuid.uuid4()}?api-version=2022-04-01',
    headers=arm_h,
    json={'properties': {'roleDefinitionId': READER, 'principalId': sp_obj_id, 'principalType': 'ServicePrincipal'}},
    timeout=20)
print(f'  HTTP {ra.status_code} {"OK" if ra.status_code in (200,201,409) else ra.text[:150]}')

# ── Step 5: Contributor on resource group ─────────────────────────────────
print('\n[5] Assigning Contributor on seobaike-rg...')
CONTRIB = f'/subscriptions/{SUBSCRIPTION}/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'
rg = requests.put(
    f'https://management.azure.com/subscriptions/{SUBSCRIPTION}/resourceGroups/seobaike-rg/providers/Microsoft.Authorization/roleAssignments/{uuid.uuid4()}?api-version=2022-04-01',
    headers=arm_h,
    json={'properties': {'roleDefinitionId': CONTRIB, 'principalId': sp_obj_id, 'principalType': 'ServicePrincipal'}},
    timeout=20)
print(f'  HTTP {rg.status_code} {"OK" if rg.status_code in (200,201,409) else rg.text[:150]}')

# ── Step 6: Admin consent ─────────────────────────────────────────────────
print('\n[6] Granting admin consent for Graph permissions...')
gsp_r = requests.get(
    "https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '00000003-0000-0000-c000-000000000000'",
    headers=graph_h, timeout=15)
if gsp_r.ok and gsp_r.json().get('value'):
    graph_sp_id = gsp_r.json()['value'][0]['id']
    for role_id, role_name in graph_perms:
        cr = requests.post(
            f'https://graph.microsoft.com/v1.0/servicePrincipals/{graph_sp_id}/appRoleAssignedTo',
            headers=graph_h,
            json={'principalId': sp_obj_id, 'resourceId': graph_sp_id, 'appRoleId': role_id},
            timeout=15)
        print(f'  {role_name}: {"OK" if cr.status_code in (200,201) else f"HTTP {cr.status_code}"}')

# ── Step 7: Update GitHub Secrets ─────────────────────────────────────────
print('\n[7] Updating GitHub Secrets...')
az_creds = json.dumps({
    'clientId': app_id, 'clientSecret': client_secret,
    'subscriptionId': SUBSCRIPTION, 'tenantId': TENANT
})
for name, val in [
    ('AZURE_CREDENTIALS',     az_creds),
    ('CLIENT_ID',             app_id),
    ('CLIENT_SECRET',         client_secret),
    ('TENANT_ID',             TENANT),
    ('AZURE_TENANT_ID',       TENANT),
    ('AZURE_SUBSCRIPTION_ID', SUBSCRIPTION),
]:
    r2 = subprocess.run(['gh','secret','set', name,'--repo', REPO,'--body', val],
                        capture_output=True, text=True)
    print(f'  {"OK" if r2.returncode==0 else "ERR"} {name}')

print('\n' + '=' * 60)
print(f'DONE: seobaike-ci-sp  clientId={app_id}')
print(f'      Roles: Reader(sub) + Contributor(seobaike-rg)')
print(f'      Graph: {len(graph_perms)} permissions + admin consent')
print(f'      GitHub Secrets: updated')
print('=' * 60)
