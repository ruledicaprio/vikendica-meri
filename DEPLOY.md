# Deploying Vikendica Meri

This is **not** a static site. It is a Cloudflare **Worker** that serves a static
asset bundle *and* owns a handful of routes backed by **D1**: the booking form,
the availability feed, the iCal export, and the owner panel behind **Cloudflare
Access**. Anything that treats `dist/` as the whole product will appear to work
and then 404 on `/api/*`.

Host: `https://vikendica-meri.iot-pages.workers.dev` — a `workers.dev`
subdomain, not a zone. That is a deliberate, temporary state; see
*Custom domain* below for what it costs us.

## How a deploy happens

Push to `main`. Cloudflare builds from git — there is **no GitHub Actions
workflow**:

```
npm run build      # vite build → dist/
npx wrangler deploy
```

Config lives in [`wrangler.jsonc`](wrangler.jsonc), and its comments are
load-bearing — read them before changing anything there.

> **A failed deploy leaves the previous version serving.** The site looks
> perfectly fine while nothing new has shipped. Always hit a live endpoint after
> pushing; never infer success from a green-looking dashboard.

## Build environment

Node is pinned to **22** by [`.node-version`](.node-version). This matters:
Cloudflare's build image still defaults to Node 20, and wrangler 4.x requires
`>=22`. With the wrong version the *build* passes and the *deploy* aborts. The
local machine runs Node 24, so this class of failure is invisible outside CI.

## Pieces

| Piece | Where |
| :--- | :--- |
| Worker entry | [`worker/index.js`](worker/index.js) |
| Access JWT verification | [`worker/access.js`](worker/access.js) |
| D1 database | `vikendica-meri`, binding `DB` |
| Schema | [`migrations/`](migrations) |
| Owner panel | `/manager/`, behind Cloudflare Access |
| Public site | `/` (Bosnian) and `/en/`, rendered per locale at build time |

### Routes the Worker owns

`POST /api/requests` · `GET /api/availability` · `GET /calendar.ics` ·
`/api/admin/*` and `/manager*` (both owner-only). Everything else falls through
to the asset router.

Each of those is listed in `assets.run_worker_first`. **A route added to
`worker/index.js` alone does not work** — `not_found_handling: "404-page"` makes
the asset router answer first, so an unlisted path gets the 404 page before the
script ever runs. `/calendar.ics` needed this for exactly the same reason
`/api/*` did.

## Cloudflare Access (the owner panel)

Application over `/manager*`, team domain `vikendica-meri.cloudflareaccess.com`.
The team domain and the AUD are `vars` in `wrangler.jsonc`; the Worker refuses
every admin request while they are unset, so a misconfigured deploy fails closed.

Traps, each of which cost a real deploy cycle:

- **Renaming the Zero Trust team breaks the Worker silently.**
  `ACCESS_TEAM_DOMAIN` is both the JWKS source and the expected token issuer, so
  a rename has to be followed here.
- **Recreating the application changes the AUD.** Edit it; do not recreate it.
- **Policies are reusable objects that must be *associated* with the
  application**, and the action must be `Allow`. `Service Auth` is for service
  tokens — it refuses human logins while looking correctly configured.
- **Leave "Enforce cookie path attribute" off.** The application covers
  `/manager*`, but the panel's API is at `/api/admin/*`, outside it. Access never
  injects `Cf-Access-Jwt-Assertion` on those calls, so they authenticate through
  the `CF_Authorization` **cookie fallback** in `worker/access.js`. Enforcing the
  path scopes that cookie to `/manager`: the panel would load fine and then 401
  on every action. That fallback is load-bearing.
  The rest: HTTP Only **on**, Binding Cookie **on**, Eager redirect **off**,
  SameSite **Lax** (`Strict` on an Access app causes `ERR_TOO_MANY_REDIRECTS`).

Diagnose authorization from **Zero Trust → Insights & Logs → Access**. It names
the email, the verdict and the matching policy — far faster than reading config
screens.

## Secrets and vars

`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `WEB3FORMS_KEY` are **vars**, not secrets:
all three are public identifiers, and each carries a comment in `wrangler.jsonc`
saying why.

`TURNSTILE_SECRET` is a real secret (`wrangler secret put`). While it is unset
the captcha check stays out of the way rather than hard-failing the form — which
is what keeps `wrangler dev` and a fresh deploy usable.

Web3Forms sends the owner notification, from inside the Worker rather than the
browser. **Web3Forms' own captcha must stay off**: it speaks hCaptcha, the form
speaks Turnstile, and their Turnstile support is a paid feature. The call sits
behind the Turnstile check and the rate limit instead.

## Database

```
npm run db:migrate:local     # wrangler d1 migrations apply --local
npm run db:migrate           # --remote
```

The owner's API token is **read-only** — enough for `d1 execute` SELECTs, not for
`d1 create` or `migrations apply`. In practice schema changes go through the
**Console** tab of the D1 dashboard.

## Observability

`observability.enabled` plus `observability.traces.enabled` in `wrangler.jsonc`,
at the default 100% sampling. The Worker deliberately logs almost nothing — the
exceptions are the two paths that would otherwise fail invisibly:

- Turnstile `siteverify` being unreachable. The check **fails open** by design, so
  without the log line the form can sit unprotected for days with nothing to show
  for it.
- A rejected or failed Web3Forms notification, which means a booking landed in D1
  and the owner never heard about it.

Both log the reason or status **only**. This Worker handles guest PII, and none
of it belongs in a log — the same reason `/calendar.ics` uses a constant
`SUMMARY:Zauzeto`.

## Local development

```
npm run dev        # vite, public site only — /api/* does not exist here
npm run worker     # wrangler dev, the real thing on :8788
```

- `wrangler dev` **snapshots `dist/` at startup**. Build *before* starting it, and
  hard-reload the browser afterwards.
- The panel needs `ACCESS_DEV_BYPASS=1` in `.dev.vars` (gitignored, never
  uploaded). Access JWTs are signed by Cloudflare, so there is no way to mint one
  locally.
- **Orphaned stacks.** Killing `workerd.exe` does nothing — the node parent
  respawns it, and repeated restarts leave several stacks fighting over the port.
  Every route then 404s or hangs, which reads exactly like a routing bug:

  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'wrangler' } | Stop-Process -Force
  Get-NetTCPConnection -LocalPort 8788 -State Listen   # must return nothing
  ```

## Custom domain

`vikendica-meri.com` is planned but not bought. Until it lands, the canonical
host is the `workers.dev` subdomain and it is hardcoded across `index.html`
(canonical, OG, JSON-LD), `public/sitemap.xml` and `public/robots.txt`.

Being on `workers.dev` rather than a zone also means **Cloudflare Image
Transformations are unavailable** — which is the entire reason the responsive
photo variants are pre-generated at build time by `npm run photo`.

The cutover, in order: custom domain on the Worker → canonical/sitemap/JSON-LD
URLs → the **Access application hostname** and the **Turnstile hostname list**.
