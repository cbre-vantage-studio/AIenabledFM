/**
 * Cloudflare Worker — IFM AI Use Case Dashboard (consolidated)
 * ---------------------------------------------------------------------------
 * One Worker, all behind a shared-password gate (HTTP Basic Auth):
 *   GET  /                     -> serves the dashboard (static asset)
 *   GET  /api/data?sheet=master|submissions
 *                              -> live Smartsheet rows as JSON (cached ~5 min)
 *   POST /api/idea             -> adds a row to the Submissions sheet
 *   (anything else)            -> static asset (env.ASSETS)
 *
 * The Smartsheet token is held SERVER-SIDE as a secret and never reaches the
 * browser. Because page + data + write are all same-origin, the browser
 * re-sends the Basic Auth credentials to the /api/* calls automatically — no
 * CORS, no client-side auth code.
 *
 * Secrets (wrangler secret put ...):
 *   SMARTSHEET_TOKEN  — Smartsheet API access token (Editor on both sheets)
 *   DASH_PASSWORD     — the shared dashboard password
 * Vars (wrangler.toml):
 *   MASTER_SHEET_ID, SUBMISSIONS_SHEET_ID
 */

const SS = "https://api.smartsheet.com/2.0";
const REALM = "IFM AI Use Case Dashboard";
const CACHE_TTL = 300; // seconds — live data is re-fetched at most every 5 min

export default {
  async fetch(request, env, ctx) {
    // --- 1. Auth gate (covers the page AND every /api/* subrequest) ---
    if (!env.DASH_PASSWORD) return text("Worker missing DASH_PASSWORD secret", 500);
    if (!authorized(request, env.DASH_PASSWORD)) {
      return new Response("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` },
      });
    }

    const url = new URL(request.url);

    // --- 2. API routes ---
    if (url.pathname === "/api/data") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return handleData(request, url, env, ctx);
    }
    if (url.pathname === "/api/idea") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleIdea(request, env);
    }

    // --- 3. Everything else: static assets (index.html etc.) ---
    return env.ASSETS.fetch(request);
  },
};

/* ------------------------------- auth ------------------------------------ */
function authorized(request, password) {
  const header = request.headers.get("Authorization") || "";
  const m = /^Basic\s+(.+)$/i.exec(header);
  if (!m) return false;
  let decoded;
  try { decoded = atob(m[1]); } catch { return false; }
  const supplied = decoded.slice(decoded.indexOf(":") + 1); // username ignored
  return timingSafeEqual(supplied, password);
}

function timingSafeEqual(a, b) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/* --------------------------- GET /api/data ------------------------------- */
async function handleData(request, url, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  if (!env.SMARTSHEET_TOKEN) return json({ error: "Worker missing SMARTSHEET_TOKEN secret" }, 500);

  const which = url.searchParams.get("sheet") || "master";
  const sheetId = which === "submissions"
    ? (env.SUBMISSIONS_SHEET_ID || "5743927238807428")
    : (env.MASTER_SHEET_ID || "8091505762717572");

  const res = await fetch(`${SS}/sheets/${sheetId}`, {
    headers: { "Authorization": `Bearer ${env.SMARTSHEET_TOKEN}` },
  });
  if (!res.ok) {
    return json({ error: "Smartsheet sheet fetch failed", status: res.status }, 502);
  }
  const sheet = await res.json();

  const titleById = {};
  for (const c of (sheet.columns || [])) titleById[c.id] = c.title;

  const rows = (sheet.rows || []).map((r, i) => {
    const cellsByTitle = {};
    for (const cell of (r.cells || [])) {
      const t = titleById[cell.columnId];
      if (!t) continue;
      const v = cell.displayValue != null ? cell.displayValue : cell.value;
      if (v != null && v !== "") cellsByTitle[t] = v;
    }
    // Stable 1-based data-row index (header=1 => first data row=2), matching
    // the dashboard's record-key convention. Not the internal rowId.
    return { row: i + 2, permalink: r.permalink || sheet.permalink || null, cellsByTitle };
  });

  const resp = json({ ok: true, sheetId, rows }, 200);
  resp.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
  ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

/* --------------------------- POST /api/idea ------------------------------ */
async function handleIdea(request, env) {
  if (!env.SMARTSHEET_TOKEN) return json({ error: "Worker missing SMARTSHEET_TOKEN secret" }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const useCase = String(body.use_case || "").trim();
  const description = String(body.description || "").trim();
  if (!useCase || !description) return json({ error: "use_case and description are required" }, 422);

  // dashboard field -> Smartsheet column title (Submissions sheet)
  const valuesByTitle = {
    "Use Case": useCase,
    "Description": description,
    "Service Line": body.service_line ?? "",
    "Impacted Role": body.impacted_role ?? "",
    "SA Priority": body.sa_priority_label || (body.sa_priority_rank ?? ""),
    "Hours Saved Per FTE per Year": body.hours_saved ?? "",
    "Submitted By": body.submitted_by ?? "",
    "Submitted At": body.submitted_at || new Date().toISOString(),
    "Status": body.status || "Idea — Submitted",
    "Source": body.source || "Dashboard Submission",
  };

  const sheetId = env.SUBMISSIONS_SHEET_ID || "5743927238807428";
  const auth = { "Authorization": `Bearer ${env.SMARTSHEET_TOKEN}`, "Content-Type": "application/json" };

  // 1) resolve column titles -> ids (robust to column reordering)
  const colRes = await fetch(`${SS}/sheets/${sheetId}/columns?includeAll=true`, { headers: auth });
  if (!colRes.ok) return json({ error: "Smartsheet columns lookup failed", status: colRes.status }, 502);
  const idByTitle = {};
  for (const c of ((await colRes.json()).data || [])) idByTitle[c.title] = c.id;

  // 2) build cells for the columns that exist + have a value
  const cells = [];
  for (const [title, value] of Object.entries(valuesByTitle)) {
    if (idByTitle[title] != null && value !== "" && value != null) {
      cells.push({ columnId: idByTitle[title], value: String(value) });
    }
  }
  if (!cells.length) return json({ error: "No matching columns found on sheet" }, 500);

  // 3) add the row (newest at top)
  const addRes = await fetch(`${SS}/sheets/${sheetId}/rows`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify([{ toTop: true, cells }]),
  });
  const addJson = await addRes.json().catch(() => ({}));
  if (!addRes.ok) {
    return json({ error: "Smartsheet add-row failed", status: addRes.status, detail: addJson.message }, 502);
  }
  return json({ ok: true, rowId: addJson.result && addJson.result[0] && addJson.result[0].id || null }, 200);
}

/* ------------------------------ helpers ---------------------------------- */
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function text(msg, status) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
