# IFM AI Use Case Dashboard

A single-file, interactive dashboard of IFM AI use cases (sourced from the Master AI Use Case Tracker). Browse, filter, and sort use cases; submit new ideas, which open as **GitHub Issues** in this repo.

**Repo:** `cbre-vantage-studio/AIenabledFM` (public)
**Live page:** https://cbre-vantage-studio.github.io/AIenabledFM/
**Submitted ideas (Issues):** https://github.com/cbre-vantage-studio/AIenabledFM/issues?q=label%3Aidea

> ⚠️ **This repo and its Pages site are PUBLIC.** `index.html` contains client/bid data (Bank of America & Amazon assumptions, savings figures), which is therefore publicly viewable by anyone with the URL. To take it down, make the repo private (disables Pages on a Free plan) or delete the repo.

The "Add Idea" form is already wired to this repo's Issues — no editing required.

---

## How submitted ideas are saved

The `const GITHUB = { ... }` block near the top of the `<script>` in `index.html` is set to `owner: "cbre-vantage-studio"`, `repo: "AIenabledFM"`, `label: "idea"`.

Clicking **+ Add Idea** and submitting:

1. Adds the idea to the on-screen list immediately (and caches it in the browser).
2. Opens a **pre-filled GitHub Issue** (labelled `idea`) in a new tab — the submitter clicks **"Submit new issue"** to save it. *(Submitter must be signed into GitHub and allow pop-ups.)*

An Issue Form template is included at `.github/ISSUE_TEMPLATE/ai-use-case-idea.yml` for anyone opening issues directly on GitHub.

> A dormant SharePoint backend also exists in the code (`const SHAREPOINT`, `enabled: false`). It is **not used** while GitHub is enabled.

## GitHub Pages

Enabled from `main` / root. Live at https://cbre-vantage-studio.github.io/AIenabledFM/ (redeploys automatically on each push). `.nojekyll` ensures files are served as-is.

## Updating the dashboard data later

The use-case data is embedded in `index.html` (the `const DATA = [...]` array). When the Master AI Use Case Tracker changes, regenerate `index.html`, commit, and push — Pages redeploys automatically.

---

### Files

| File | Purpose |
|------|---------|
| `index.html` | The dashboard (Pages serves it as the site root). |
| `.nojekyll` | Tells Pages to serve files as-is (no Jekyll processing). |
| `.gitignore` | Ignores OS cruft (`.DS_Store`, etc.). |
| `.github/ISSUE_TEMPLATE/ai-use-case-idea.yml` | Structured Issue form for idea submissions. |
| `README.md` | This file. |
