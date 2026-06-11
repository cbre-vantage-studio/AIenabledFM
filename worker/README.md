# Add Idea → Smartsheet (Cloudflare Worker)

This tiny Worker is the secure bridge between the public dashboard and Smartsheet. The dashboard `fetch()`es it; the Worker holds the Smartsheet token **server-side** and adds a row to the submissions sheet. The token is never in the page.

- **Target sheet:** `AI Use Case Ideas (Submissions)` — id `5743927238807428` (workspace: *AI Enabled FM*)
- **Files:** `worker.js` (the code), `wrangler.toml` (config)

## One-time setup (~10 min)

### 1. Get a Smartsheet API token
Smartsheet → your avatar → **Personal Settings → API Access → Generate new access token**. Copy it (shown once). The token belongs to a user with **Editor** access to the submissions sheet.

### 2. Install the CLI and log in
```bash
npm install -g wrangler
wrangler login
```

### 3. Deploy from this folder
```bash
cd worker
wrangler deploy
```
This prints your Worker URL, e.g. `https://aienabledfm-idea-proxy.<your-subdomain>.workers.dev`.

### 4. Store the token as a secret
```bash
wrangler secret put SMARTSHEET_TOKEN
# paste the token when prompted
```
(`SHEET_ID` and `ALLOWED_ORIGIN` are already set in `wrangler.toml` — edit them there if needed, then `wrangler deploy` again.)

### 5. Point the dashboard at the Worker
In `../index.html`, find `const IDEA_API = {` and set:
```js
url: "https://aienabledfm-idea-proxy.<your-subdomain>.workers.dev",
```
Commit & push — Pages redeploys. Submitting an idea now writes a Smartsheet row with no navigation.

## Test it
```bash
curl -X POST https://aienabledfm-idea-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"use_case":"Test idea","description":"Checking the Worker → Smartsheet path."}'
# -> {"ok":true,"rowId":...}
```
Then confirm a new row appears in the submissions sheet.

## Notes / hardening
- **CORS** is locked to `ALLOWED_ORIGIN`. Note an `Origin` header is trivially spoofed by non-browser clients, so this stops casual cross-site browser use but is **not** anti-abuse. Because the dashboard is public, the endpoint is effectively open.
- **Anti-spam (optional):** add Cloudflare **Turnstile** (a free CAPTCHA) or a **Rate Limiting** rule on the Worker route if submission spam becomes a concern.
- The Worker resolves Smartsheet **column ids by title at runtime**, so renaming/reordering columns is fine as long as the titles match those in `worker.js`.
