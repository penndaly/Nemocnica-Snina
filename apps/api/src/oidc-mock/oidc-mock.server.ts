/**
 * Minimal mock OIDC provider for local dev and CI.
 * Implements just enough of the OpenID Connect spec to support the portal login flow:
 *   GET  /authorize  → redirects with code=test-code&state=<state>
 *   POST /token      → returns a test access_token + id_token
 *   GET  /userinfo   → returns { sub: "test-patient-001", name: "Jozef Mak" }
 *
 * ENABLED ONLY when OIDC_MOCK_ENABLED=true.
 * NEVER starts in production (guarded in main.ts).
 *
 * Usage in tests: OIDC_MOCK_ENABLED=true, OIDC_MOCK_PORT=4010
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { SignJWT } from 'jose';

const PORT   = parseInt(process.env['OIDC_MOCK_PORT'] ?? '4010', 10);
const SECRET = new TextEncoder().encode('mock-oidc-secret-not-for-production');
const ISSUER = `http://localhost:${PORT}`;

// Seeded test patient
const TEST_PATIENT = { sub: 'test-patient-001', name: 'Jozef Mak' };

async function mintToken(sub: string, name: string): Promise<string> {
  return new SignJWT({ sub, name, iss: ISSUER, aud: 'dev-client' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

function parseBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c: Buffer) => { data += c.toString(); });
    req.on('end', () => {
      const params: Record<string, string> = {};
      for (const [k, v] of new URLSearchParams(data)) params[k] = v;
      resolve(params);
    });
  });
}

export function startMockOidcServer(): void {
  if (process.env['OIDC_MOCK_ENABLED'] !== 'true') return;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('OIDC mock must not start in production');
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', ISSUER);

    if (url.pathname === '/authorize') {
      const state       = url.searchParams.get('state') ?? '';
      const redirectUri = url.searchParams.get('redirect_uri') ?? 'http://localhost:3000/sk/portal/callback';
      const redirect = new URL(redirectUri);
      redirect.searchParams.set('code', 'mock-code-001');
      redirect.searchParams.set('state', state);
      res.writeHead(302, { Location: redirect.toString() });
      res.end();
      return;
    }

    if (url.pathname === '/token' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body['code'] !== 'mock-code-001') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      const accessToken = await mintToken(TEST_PATIENT.sub, TEST_PATIENT.name);
      const idToken     = await mintToken(TEST_PATIENT.sub, TEST_PATIENT.name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: 3600 }));
      return;
    }

    if (url.pathname === '/userinfo' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(TEST_PATIENT));
      return;
    }

    // Discovery endpoint (minimal)
    if (url.pathname === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['HS256'],
        code_challenge_methods_supported: ['S256'],
      }));
      return;
    }

    res.writeHead(404); res.end();
  });

  server.listen(PORT, () => {
    console.log(`[OIDC mock] running on port ${PORT} (dev/CI only)`);
  });
}
