// Cloudflare Access JWT verification.
//
// Access already enforces the policy at the edge for /manager and /api/admin/*,
// so in normal operation nothing unauthenticated reaches these routes. This is
// the second lock: it checks the assertion Access attaches, so the endpoints
// that mutate bookings and read guest personal data are not open to anything
// that reaches the Worker by some other path — a misconfigured policy, a route
// added later, a preview URL.
//
// RS256 against the team's public JWKS, using Web Crypto only; no dependency.

const CLOCK_SKEW_S = 60;

/** Base64url → Uint8Array. */
function b64uToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64uToJson(s) {
  return JSON.parse(new TextDecoder().decode(b64uToBytes(s)));
}

// The JWKS is small and rotates rarely, but fetching it on every admin request
// would put a network round trip in front of every button press in the panel.
let jwksCache = { url: '', keys: null, at: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getKeys(teamDomain) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const fresh = jwksCache.url === url && jwksCache.keys && Date.now() - jwksCache.at < JWKS_TTL_MS;
  if (fresh) return jwksCache.keys;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Access certs fetch failed: ${res.status}`);
  const { keys } = await res.json();
  jwksCache = { url, keys, at: Date.now() };
  return keys;
}

async function importKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * Verify the Cf-Access-Jwt-Assertion on `request`.
 *
 * Returns { ok: true, email } or { ok: false, reason }. Never throws for a bad
 * token — only a genuine infrastructure failure (JWKS unreachable) throws.
 */
export async function verifyAccess(request, env) {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  // Refusing to run unconfigured is the safe default: a missing variable must
  // not silently turn the check into a no-op.
  if (!teamDomain || !audience) {
    return { ok: false, reason: 'Access is not configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD)' };
  }

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    (request.headers.get('Cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) return { ok: false, reason: 'no assertion' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  const [rawHeader, rawPayload, rawSig] = parts;

  let header, payload;
  try {
    header = b64uToJson(rawHeader);
    payload = b64uToJson(rawPayload);
  } catch {
    return { ok: false, reason: 'undecodable token' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: `unexpected alg ${header.alg}` };

  const keys = await getKeys(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'unknown kid' };

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    await importKey(jwk),
    b64uToBytes(rawSig),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
  );
  if (!valid) return { ok: false, reason: 'bad signature' };

  // A valid signature is not enough: an assertion minted for a different Access
  // application, or an expired one, must still be refused.
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) return { ok: false, reason: 'audience mismatch' };
  if (payload.iss !== `https://${teamDomain}`) return { ok: false, reason: 'issuer mismatch' };
  if (typeof payload.exp === 'number' && payload.exp + CLOCK_SKEW_S < now) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > now) {
    return { ok: false, reason: 'not yet valid' };
  }

  return { ok: true, email: payload.email || '' };
}
