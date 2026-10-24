// Prints a new VAPID key pair for push notifications.
//
//   npm run vapid
//   npx wrangler secret put VAPID_PRIVATE_JWK     ← paste the JSON line
//
// The private key never needs to be stored anywhere else: the worker derives
// the public key from it. Generating a new one disconnects every phone that
// already subscribed (they turn notifications on again in the panel).
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const { kty, crv, d, x, y } = await crypto.subtle.exportKey('jwk', privateKey);
console.log(JSON.stringify({ kty, crv, d, x, y }));
