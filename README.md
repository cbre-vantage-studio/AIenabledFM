# IFM AI Use Case Dashboard

A single-file, interactive dashboard of IFM AI use cases (sourced from the Master AI Use Case Tracker). Browse, filter, and sort use cases; submit new ideas, which are saved **silently to Smartsheet** in the background (no navigation away from the dashboard).

**Repo:** `cbre-vantage-studio/AIenabledFM` (public)
**Live page:** https://cbre-vantage-studio.github.io/AIenabledFM/
**Submissions land in Smartsheet:** *AI Use Case Ideas (Submissions)* — sheet id `5743927238807428` (workspace *AI Enabled FM*).

> ⚠️ **This repo and its Pages site are PUBLIC.** `index.html` contains client/bid data (Bank of America & Amazon assumptions, savings figures), publicly viewable by anyone with the URL.

---

## How submitted ideas are saved (background → Smartsheet)

A public static page can't safely hold a write token, so submission goes through a tiny **Cloudflare Worker** that holds the Smartsheet token server-side:

```
Dashboard  --POST idea JSON-->  Cloudflare Worker  --Smartsheet API-->  Submissions sheet
```

Clicking **+ Add Idea → Submit**:
1. Adds the idea to the on-screen list and caches it in the browser.
2. `fetch()`es the Worker, which adds a row to the Smartsheet — the user **stays on the dashboard** and sees a success toast. No new tab, no manual save.

**Setup (one-time, required before submission works):** see [`worker/README.md`](worker/README.md). In short: deploy the Worker, store the Smartsheet token as a secret, then paste the Worker URL into the `const IDEA_API = { url: ... }` block near the top of the `<script>` in `index.html` and push.

> ⏳ **Until the Worker is deployed and `IDEA_API.url` is set,** submitting shows "submission endpoint not configured yet" (the idea is still cached locally). The legacy GitHub-Issues path is disabled (`const GITHUB.enabled = false`) but kept in the code for reference. A dormant SharePoint backend also remains (`SHAREPOINT.enabled = false`).

## GitHub Pages

Enabled from `main` / root; live at https://cbre-vantage-studio.github.io/AIenabledFM/ (redeploys on each push). `.nojekyll` serves files as-is.

## Updating the dashboard data later

The use-case data is embedded in `index.html` (the `const DATA = [...]` array). Regenerate, commit, push — Pages redeploys automatically.

---

### Files

| File | Purpose |
|------|---------|
| `index.html` | The dashboard (Pages serves it as the site root). |
| `worker/worker.js` | Cloudflare Worker: receives an idea, writes a Smartsheet row. |
| `worker/wrangler.toml` | Worker config (sheet id, allowed origin). |
| `worker/README.md` | Worker deploy + token setup steps. |
| `.nojekyll` | Serve files as-is (no Jekyll). |
| `.gitignore` | Ignores OS cruft. |
| `.github/ISSUE_TEMPLATE/ai-use-case-idea.yml` | (Legacy) issue form, from the GitHub-Issues approach. |
