# Dashboard Worker — gate + live data + idea submit (Cloudflare Worker)

One Worker serves the whole app and gates every request with a shared password (HTTP Basic Auth). It holds the Smartsheet token **server-side** so the token never reaches the browser.

```
Browser ──Basic Auth──> Worker ──┬─ GET /                       → dashboard (static asset)
                                 ├─ GET /api/data?sheet=master  → live Master Tracker JSON (cached ~5 min)
                                 ├─ GET /api/data?sheet=submissions → live Ideas JSON
                                 └─ POST /api/idea               → add row to Submissions sheet
```

- **Master Tracker:** `8091505762717572` · **Submissions:** `5743927238807428` (workspace *AI Enabled FM*)
- **Files:** `worker.js` (code), `wrangler.toml` (config + `[assets]` binding → `../public`)
- Same-origin, so there is no CORS and the browser auto-sends the Basic Auth credentials to the `/api/*` calls.

## One-time setup (~10 min)

### 1. Get a Smartsheet API token
Smartsheet → avatar → **Personal Settings → API Access → Generate new access token**. The token's user needs **Editor** access to both sheets (Editor also allows read).

### 2. Install the CLI and log in
```bash
npm install -g wrangler
wrangler login
```

### 3. Set the secrets (from this `worker/` folder)
```bash
wrangler secret put SMARTSHEET_TOKEN   # paste the Smartsheet token
wrangler secret put DASH_PASSWORD      # the shared dashboard password
```

### 4. Deploy
```bash
wrangler deploy
```
Prints the Worker URL, e.g. `https://aienabledfm.<your-subdomain>.workers.dev`. That URL **is** the dashboard — open it and the browser prompts for the password (username can be anything).

> `wrangler deploy` uploads `../public/index.html` as the static asset and `MASTER_SHEET_ID` / `SUBMISSIONS_SHEET_ID` from `wrangler.toml`. `run_worker_first = true` ensures the auth check runs before the page is served.

## Test it
```bash
curl -i https://aienabledfm.<sub>.workers.dev/                       # -> 401
curl -u cbre:<password> https://aienabledfm.<sub>.workers.dev/       # -> dashboard HTML
curl -u cbre:<password> "https://aienabledfm.<sub>.workers.dev/api/data?sheet=master"       # -> {"ok":true,"rows":[…]}
curl -u cbre:<password> "https://aienabledfm.<sub>.workers.dev/api/data?sheet=submissions"  # -> submitted ideas
curl -u cbre:<password> -X POST https://aienabledfm.<sub>.workers.dev/api/idea \
  -H "Content-Type: application/json" \
  -d '{"use_case":"Test idea","description":"Worker → Smartsheet path."}'                   # -> {"ok":true,"rowId":…}
```

## Notes / hardening
- **Auth** is a single shared secret over HTTPS — keeps anonymous visitors out; it is not per-person identity. Rotate by re-running `wrangler secret put DASH_PASSWORD` and `wrangler deploy`.
- **GitHub Pages must be disabled** for this repo (Settings → Pages) — the dashboard is now served only by this gated Worker. The embedded data has been removed from `index.html`, so the repo source no longer contains bid data.
- `/api/data` responses are cached ~5 min (`caches.default`); the cache is only read *after* the auth check passes.
- Column titles are resolved at runtime, so renaming/reordering sheet columns is fine as long as the titles still match.
- For per-person `@cbre.com` identity later, put the Worker behind a Cloudflare-proxied domain + Cloudflare Access (requires a custom domain).
