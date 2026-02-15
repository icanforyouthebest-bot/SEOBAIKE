"""
OAuth 認證整合範例（L4）
微軟提供之 FastMCP + Google OAuth 參考實作。
實際 SEOBAIKE 認證走 Supabase Auth。
"""

import os
from fastapi import Request, Response
from fastmcp import FastMCP, AuthSettings, ClientRegistrationOptions
from oauth_provider import GoogleOAuthProvider, ServerSettings

settings = ServerSettings(
    host='localhost',
    port=3000,
    server_url='http://localhost:3000',
    callback_path='http://localhost:3000/callback',
    client_id=os.environ.get('OAUTH_CLIENT_ID', ''),
    client_secret=os.environ.get('OAUTH_CLIENT_SECRET', '')
)

oauth_provider = GoogleOAuthProvider(settings)
auth_settings = AuthSettings(
    issuer_url=settings.server_url,
    client_registration_options=ClientRegistrationOptions(enabled=True),
    required_scopes=['openid']
)

app = FastMCP(
    name='Google OAuth MCP Server',
    auth_server_provider=oauth_provider,
    host=settings.host,
    port=settings.port,
    auth=auth_settings
)


@app.custom_route('/callback', methods=['GET'])
async def callback_handler(request: Request) -> Response:
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    redirect_uri = await oauth_provider.handle_callback(code, state)
    return Response(status_code=302, headers={'Location': redirect_uri})


if __name__ == '__main__':
    app.run()
