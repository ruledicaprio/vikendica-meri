# Vikendica Meri — Deployment

This is a **static site** (Vite build). `npm run build` produces a `dist/` folder
with `index.html`, hashed JS/CSS in `dist/assets/`, and the photos under
`dist/smjestaj`, `dist/vlasic`, `dist/travnik`. Any static web server can serve it —
Vite's own `dev`/`preview` are **not** for production.

```bash
npm run build      # → dist/
npm run preview    # local production-like check at http://localhost:5173 (NOT public)
```

---

## ✅ Quickstart — Variant 1: managed static host (chosen)

Free, automatic HTTPS, global CDN, nothing running at home. The repo is already
prepared: caching via [`public/_headers`](public/_headers), build config in
[`netlify.toml`](netlify.toml), Node pinned via [`.nvmrc`](.nvmrc).

### Fastest first deploy — drag & drop (no git needed)
1. `npm run build` (already done — `dist/` is ready).
2. Go to **Cloudflare Pages → Create → Direct Upload** (dash.cloudflare.com → Workers & Pages),
   or **Netlify Drop** (<https://app.netlify.com/drop>).
3. Drag the whole **`dist/`** folder in. You get a live `https://…pages.dev` /
   `…netlify.app` URL in seconds.

### Recommended ongoing setup — git-connected (auto-deploy on each change)
1. Put this project on GitHub/GitLab.
2. **Cloudflare Pages → Create → Connect to Git** (or Netlify → Add new site → Import):
   - Build command: `npm run build`
   - Output directory: `dist`
   (Netlify reads these from `netlify.toml` automatically.)
3. Every push → automatic rebuild & deploy.

### Custom domain
In the host's dashboard → **Custom domains** → add your **real** domain (see the
`.meri` note below — you need a domain that actually resolves). The host issues the
HTTPS certificate automatically; you just point a CNAME/A record as it instructs.

### Before going live
- Set a free **Web3Forms** key in [`src/main.js`](src/main.js) (`WEB3FORMS_KEY`) so the
  reservation form sends in-page (otherwise it opens the visitor's email client).

---

## ⚠️ First: the domain `babanovac.villa.meri` will not work publicly

`.meri` is **not** a real top-level domain. Public DNS cannot resolve it and
Let's Encrypt cannot issue an HTTPS certificate for it. You have three honest paths:

1. **Register/own a real domain** (e.g. `vikendica-meri.ba`, `villa-meri.com`, …) and
   point a subdomain like `babanovac.` at your server. *(recommended)*
2. **Use a free hostname** — [DuckDNS](https://duckdns.org), or a free Cloudflare
   subdomain — and use that as the public name.
3. **Local network only** — keep `babanovac.villa.meri` as an internal name (hosts
   file / local DNS) and use Caddy's `tls internal` (self-signed). Not reachable from
   the internet.

Everywhere below, replace the example domain with whatever real name you choose.

---

## Also check: do you actually have a public IPv4?

Your machine is `192.168.1.4` behind router `192.168.1.1`. Many BiH ISPs put IPv4
behind **CGNAT**, meaning port-forwarding 80/443 **will not** make you reachable over
IPv4 from the internet (you don't own a public IPv4). Your `systeminfo` shows a public
**IPv6** (`2a02:27b0:…`), so IPv6 visitors could reach you, but not IPv4-only ones.

➡️ If you're behind CGNAT (or just want zero router fiddling), **use Cloudflare Tunnel**
(Option C) — it needs no public IP and no open ports.

---

## Option A — Caddy on this PC (self-hosting, your stated goal)

Caddy auto-obtains and renews Let's Encrypt certificates and serves static files.

1. Download Caddy for Windows: <https://caddyserver.com/download> → put `caddy.exe`
   somewhere (e.g. `C:\caddy\`).
2. Use the provided [`Caddyfile`](Caddyfile) in this repo. Edit it:
   - replace `vikendica-meri.example` with your **real** domain,
   - confirm the `root *` path points at `E:/vikendica-meri/dist`.
3. Open **PowerShell as Administrator** in the folder with `caddy.exe` and run:
   ```powershell
   .\caddy.exe run --config "E:\vikendica-meri\Caddyfile"
   ```
   For background / always-on, install it as a service:
   ```powershell
   .\caddy.exe install
   .\caddy.exe start
   ```
4. **Router:** forward TCP **80** and **443** to `192.168.1.4`.
5. **DNS:** create an `A` record (public IPv4) or `AAAA` record (your IPv6) — or a
   `CNAME` to your DuckDNS host — for the chosen domain.
6. **Keep it awake 24/7:** Power plan → *High performance*, disable sleep/hibernate
   (`powercfg /change standby-timeout-ac 0` and `…/hibernate-timeout-ac 0`).

> The included Caddyfile already sets sensible **Cache-Control** headers: 1-year
> immutable for `/assets/*`, 1-week for the photo folders, `no-cache` for HTML.

---

## Option B — nginx + win-acme (if you prefer nginx)

Minimal `server` block once you have a cert:

```nginx
server {
    listen 443 ssl;
    server_name your-domain;
    root E:/vikendica-meri/dist;
    index index.html;

    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ~ ^/(smjestaj|vlasic|travnik)/ { add_header Cache-Control "public, max-age=604800"; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location / { try_files $uri $uri/ /index.html; }

    ssl_certificate     C:/certs/fullchain.pem;
    ssl_certificate_key C:/certs/privkey.pem;
}
server { listen 80; server_name your-domain; return 301 https://$host$request_uri; }
```

Get/renew the certificate with [win-acme](https://www.win-acme.com/) (Windows ACME
client) and schedule renewal via Task Scheduler.

---

## Option C — Cloudflare Tunnel (recommended if ports are blocked / CGNAT)

No port-forwarding, no public IP, free automatic HTTPS. Requires a domain on a
Cloudflare account (a free domain works).

1. Add your domain to Cloudflare (free plan), so Cloudflare manages its DNS.
2. Install `cloudflared` for Windows.
3. Serve `dist/` locally with Caddy/nginx (or even `npm run preview`) on, say,
   `http://localhost:8080`.
4. Create + run the tunnel:
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create vikendica
   cloudflared tunnel route dns vikendica babanovac.your-domain
   cloudflared tunnel --url http://localhost:8080 run vikendica
   ```
5. Install it as a service so it runs 24/7: `cloudflared service install`.

---

## Option D — Managed static host (easiest, no 24/7 PC) ⭐

For a rental presentation site this is usually the best trade-off: free, global CDN,
automatic HTTPS, nothing running at home.

- **Cloudflare Pages** or **Netlify**: connect the git repo (build command
  `npm run build`, output dir `dist`) — or drag-and-drop the `dist/` folder.
- Point your real domain at it via the dashboard. Done.

You keep full control of the code; only the hosting moves off your PC.

---

## After deploying — two things to finish

- **Reservation form:** set a free [Web3Forms](https://web3forms.com) access key in
  `src/main.js` (`WEB3FORMS_KEY`) so upiti send in-page. Without it the form falls
  back to opening the visitor's email client to `villa-meri@gmail.com`.
- **Rebuild after any change:** `npm run build`, then your server serves the new
  `dist/` automatically (Caddy/nginx) or on next deploy (Pages/Netlify).
