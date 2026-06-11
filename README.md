# IFM AI Use Case Dashboard

A single-file, interactive dashboard of IFM AI use cases. It reads **live from Smartsheet** and is served behind a **shared-password gate** by one Cloudflare Worker. Browse, filter, and sort use cases; view an **Ideas** tab of submitted ideas; and submit new ideas, which are saved to Smartsheet in the background (no navigation away).

**Repo:** `cbre-vantage-studio/AIenabledFM`
**Served by:** the Cloudflare Worker (see [`worker/README.md`](worker/README.md)) — its URL is the dashboard.

## How it works

```
Browser ──Basic Auth──> Cloudflare Worker ──┬─ GET /                → dashboard page (public/index.html)
                                            ├─ GET /api/data        → live Smartsheet rows (Master / Submissions)
                                            └─ POST /api/idea        → adds a row to the Submissions sheet
```

- **Main data is live.** On each load the page fetches `/api/data?sheet=master` and renders the KPIs, "Ready for Deployment" grid, and table from the **AI Use Case Master Tracker** (sheet `8091505762717572`). There is no embedded data — edit the Smartsheet, reload, and the dashboard reflects it.
- **Ideas tab.** Reads `/api/data?sheet=submissions` (the **AI Use Case Ideas (Submissions)** sheet, `5743927238807428`) and lists submitted ideas; clicking one opens the in-dashboard detail view.
- **Add Idea.** Submitting POSTs to `/api/idea`; the Worker holds the Smartsheet token server-side and appends a row. The submitter stays on the dashboard and sees a success toast; the Ideas tab refreshes.
- **Gate.** The Worker requires a shared password (HTTP Basic Auth) on every request — page, data, and submit. Because everything is same-origin, the browser supplies the credentials to the API calls automatically (no CORS).

## Setup & deploy

See [`worker/README.md`](worker/README.md): set the `SMARTSHEET_TOKEN` and `DASH_PASSWORD` secrets, then `wrangler deploy`. The printed Worker URL is the dashboard.

> **Disable GitHub Pages** (Settings → Pages). The dashboard is served only by the gated Worker now; the public Pages site is retired. The embedded `DATA` has been removed from `index.html`, so the repo source no longer contains client/bid data.

## Updating the dashboard data

Edit the **Master Tracker** Smartsheet directly — the dashboard picks up changes on the next load (data is cached ~5 min at the Worker). To change the page itself, edit `public/index.html` and `wrangler deploy`.

## Files

| File | Purpose |
|------|---------|
| `public/index.html` | The dashboard (served by the Worker as a static asset). |
| `worker/worker.js` | Cloudflare Worker: auth gate, live reads, idea write, asset serving. |
| `worker/wrangler.toml` | Worker config — `[assets]` → `../public`, sheet ids. |
| `worker/README.md` | Worker deploy + secrets. |
| `.github/ISSUE_TEMPLATE/ai-use-case-idea.yml` | (Legacy) issue form from the old GitHub-Issues approach. |
| `.nojekyll` | Legacy Pages artifact (no longer used). |
