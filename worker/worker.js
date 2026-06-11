/**
 * Cloudflare Worker — "Add Idea" dashboard  ->  Smartsheet row
 * ---------------------------------------------------------------------------
 * The dashboard POSTs an idea (JSON) to this Worker. The Worker holds the
 * Smartsheet API token SERVER-SIDE (as a secret) and adds a row to the
 * submissions sheet. The token is never exposed to the browser.
 *
 * Configure (see worker/README.md):
 *   SMARTSHEET_TOKEN  (secret) — Smartsheet API access token
 *   SHEET_ID          (var)    — target sheet id (default below)
 *   ALLOWED_ORIGIN    (var)    — e.g. https://cbre-vantage-studio.github.io  ("*" to allow any)
 */

const SS = "https://api.smartsheet.com/2.0";
const DEFAULT_SHEET_ID = "5743927238807428"; // AI Use Case Ideas (Submissions)

export default {
  async fetch(request, env) {
    const allow = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allow,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (!env.SMARTSHEET_TOKEN) return json({ error: "Worker missing SMARTSHEET_TOKEN secret" }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400, cors); }

    const useCase = String(body.use_case || "").trim();
    const description = String(body.description || "").trim();
    if (!useCase || !description) return json({ error: "use_case and description are required" }, 422, cors);

    // dashboard field -> Smartsheet column title
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

    const sheetId = env.SHEET_ID || DEFAULT_SHEET_ID;
    const auth = { "Authorization": `Bearer ${env.SMARTSHEET_TOKEN}`, "Content-Type": "application/json" };

    // 1) resolve column titles -> ids (robust to column reordering)
    const colRes = await fetch(`${SS}/sheets/${sheetId}/columns?includeAll=true`, { headers: auth });
    if (!colRes.ok) {
      return json({ error: "Smartsheet columns lookup failed", status: colRes.status }, 502, cors);
    }
    const idByTitle = {};
    for (const c of ((await colRes.json()).data || [])) idByTitle[c.title] = c.id;

    // 2) build cells for the columns that exist + have a value
    const cells = [];
    for (const [title, value] of Object.entries(valuesByTitle)) {
      if (idByTitle[title] != null && value !== "" && value != null) {
        cells.push({ columnId: idByTitle[title], value: String(value) });
      }
    }
    if (!cells.length) return json({ error: "No matching columns found on sheet" }, 500, cors);

    // 3) add the row (newest at top)
    const addRes = await fetch(`${SS}/sheets/${sheetId}/rows`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([{ toTop: true, cells }]),
    });
    const addJson = await addRes.json().catch(() => ({}));
    if (!addRes.ok) {
      return json({ error: "Smartsheet add-row failed", status: addRes.status, detail: addJson.message }, 502, cors);
    }

    return json({ ok: true, rowId: addJson.result && addJson.result[0] && addJson.result[0].id || null }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
