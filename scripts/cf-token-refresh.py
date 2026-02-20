#!/usr/bin/env python3
"""
Cloudflare OAuth Token Auto-Refresh for CI
Refreshes CLOUDFLARE_OAUTH_REFRESH and updates GitHub secret.
Writes new access token to GITHUB_ENV for wrangler deploy.
"""
import os, json, base64, urllib.request, urllib.parse, ssl, sys

REFRESH = os.environ.get('CLOUDFLARE_OAUTH_REFRESH', '')
PAT = os.environ.get('REPO_PAT', '')
REPO = os.environ.get('GITHUB_REPOSITORY', 'icanforyouthebest-bot/SEOBAIKE')
GITHUB_ENV = os.environ.get('GITHUB_ENV', '')

if not REFRESH:
    print('ERROR: CLOUDFLARE_OAUTH_REFRESH not set')
    sys.exit(1)

ctx = ssl.create_default_context()

# 1. Refresh CF OAuth token
print('Refreshing Cloudflare OAuth token...')
data = urllib.parse.urlencode({
    'grant_type': 'refresh_token',
    'refresh_token': REFRESH,
    'client_id': '54d11594-84e4-41aa-b438-e81b8fa78ee7',
    'client_secret': ''
})

req = urllib.request.Request(
    'https://dash.cloudflare.com/oauth2/token',
    data=data.encode(),
    method='POST'
)
req.add_header('Content-Type', 'application/x-www-form-urlencoded')

try:
    with urllib.request.urlopen(req, context=ctx) as r:
        td = json.loads(r.read())
except Exception as e:
    print(f'ERROR: Token refresh request failed: {e}')
    sys.exit(1)

new_access = td.get('access_token', '')
new_refresh = td.get('refresh_token', '')

if not new_access:
    print(f'ERROR: Token refresh failed: {td}')
    sys.exit(1)

print(f'CF token refreshed (expires_in={td.get("expires_in")}s)')

# 2. Write access token to GITHUB_ENV
if GITHUB_ENV:
    with open(GITHUB_ENV, 'a') as f:
        f.write(f'CF_FRESH_TOKEN={new_access}\n')
    print('Token written to GITHUB_ENV')
else:
    print(f'WARNING: GITHUB_ENV not set, token: {new_access[:20]}...')

# 3. Update CLOUDFLARE_OAUTH_REFRESH GitHub secret
if not PAT or not new_refresh:
    print('WARNING: Cannot update refresh token secret (PAT or new_refresh missing)')
    sys.exit(0)

try:
    from nacl.public import PublicKey, SealedBox
except ImportError:
    print('WARNING: pynacl not installed, skipping secret update')
    sys.exit(0)

# Get public key
try:
    kr = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}/actions/secrets/public-key'
    )
    kr.add_header('Authorization', f'Bearer {PAT}')
    kr.add_header('User-Agent', 'CI-TokenRefresh')
    kr.add_header('Accept', 'application/vnd.github.v3+json')
    with urllib.request.urlopen(kr, context=ctx) as r:
        kd = json.loads(r.read())
except Exception as e:
    print(f'WARNING: Could not get GitHub public key: {e}')
    sys.exit(0)

# Encrypt new refresh token
box = SealedBox(PublicKey(base64.b64decode(kd['key'])))
enc = base64.b64encode(box.encrypt(new_refresh.encode())).decode()
body = json.dumps({'encrypted_value': enc, 'key_id': kd['key_id']}).encode()

try:
    sr = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}/actions/secrets/CLOUDFLARE_OAUTH_REFRESH',
        data=body,
        method='PUT'
    )
    sr.add_header('Authorization', f'Bearer {PAT}')
    sr.add_header('User-Agent', 'CI-TokenRefresh')
    sr.add_header('Accept', 'application/vnd.github.v3+json')
    sr.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(sr, context=ctx) as r:
        print(f'Refresh token secret updated: HTTP {r.status}')
except urllib.error.HTTPError as e:
    print(f'WARNING: Secret update failed: HTTP {e.code} - {e.read()}')
except Exception as e:
    print(f'WARNING: Secret update error: {e}')

print('CF token auto-refresh complete!')
