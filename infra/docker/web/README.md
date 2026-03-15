# Web Container (`comms-web`)

Vite + React frontend served by **nginx:1.27-alpine**.  
All commands are run from the **monorepo root** (`Centralized-Comms-Lib/`).

---

## What's inside

| Stage | Image | Purpose |
|-------|-------|---------|
| `builder` | `node:20-alpine` | Runs `npm ci` + `vite build`, outputs static assets to `dist/` |
| `runner` | `nginx:1.27-alpine` | Serves the built assets on port **80** as a non-root user |

**nginx features included (`nginx.conf`):**
- SPA fallback — all routes fall back to `index.html`
- `index.html` is never cached (`no-store`)
- JS/CSS/font assets cached for 6 months (`immutable`)
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`
- gzip compression enabled

---

## Prerequisites

- Docker ≥ 24
- A `package-lock.json` present at the monorepo root (run `npm install` once if missing)

---

## Build

> **Context path**: The build context is the monorepo root (`.`) so Docker can access the root lockfile, workspace manifests, and `nginx.conf`.  
> **Dockerfile path**: `infra/docker/web/Dockerfile`

```bash
docker build \
  -f infra/docker/web/Dockerfile \
  -t comms-web \
  .
```

---

## Run

```bash
docker run --rm -p 3000:80 comms-web
```

The app is now available at **http://localhost:3000**.

### Detached (background)

```bash
docker run -d --name comms-web -p 3000:80 comms-web

# View logs
docker logs -f comms-web

# Stop
docker stop comms-web
```

---

## Verify

```bash
# Page loads (200 OK)
curl -I http://localhost:3000

# SPA routing works — React handles the route, not the server
curl -I http://localhost:3000/some/nested/route

# Static asset is cached immutably (look for Cache-Control)
curl -I http://localhost:3000/assets/<file>.js
```

---

## Customisation

| What | How |
|------|-----|
| Change the port | Edit the host-side of `-p <HOST>:80` in the run command |
| Inject runtime env vars | Serve a `/env.js` file via a custom `entrypoint.sh` that writes `window.__ENV__` before nginx starts |
| Add HTTPS / TLS | Use a reverse proxy (e.g. Caddy, Traefik) in front of this container — do not bake certs inside |
| Change nginx behaviour | Edit `infra/docker/web/nginx.conf` and rebuild |
