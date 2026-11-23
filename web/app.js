// GnoSage dashboard — reads the review board realm on the Onyx testnet
// via public RPC (vm/qeval_json, plain GET, no wallet needed).
//
// qeval_json returns Amino JSON TypedValues: {"results":[{"T":{...type},
// "N": "...", "V": ...}]}. What we learned from live data (23 Nov 2026):
// - Numbers and bools arrive in "N": base64 little-endian int64
//   ("AQAAAAAAAAA=" = 1). "V" is NOT set for them.
// - Strings arrive in "V" as {"@type":"/gno.StringValue","value":"..."}.
// - Slices arrive in "V" as {"@type":"/gno.SliceValue","Base":{"List":[
//   TypedValue, ...]}} — unwrap each element.
// - Struct POINTERS (GetReview / LatestAgentReview return *Review) come
//   back as a bare RefValue with no fields. The dashboard never reads a
//   review struct directly; it queries individual fields instead, e.g.
//   LatestAgentReview("...").Score — qeval supports field access.
// - "N" and "V" are both omitted when the value is the zero value of its
//   type (false, 0, "", nil), so a missing value means zero, not error.

const RPC_URL = "https://rpc.latest.testnets.gno.land:443";
const GNOWEB_URL = "https://latest.testnets.gno.land";
const REALM = "gno.land/r/g1csu73nv8c38a8xru5vk6wgq0ltnpvzd79a6udn/gnosage";

const $ = (id) => document.getElementById(id);

function hex(s) {
  return [...new TextEncoder().encode(s)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function qeval(expr) {
  const data = `${REALM}.${expr}`;
  const url = `${RPC_URL}/abci_query?path=%22vm/qeval_json%22&data=0x${hex(data)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = await res.json();
  const rb = body.result?.response?.ResponseBase;
  if (rb?.Error) throw new Error(`query failed: ${JSON.stringify(rb.Error)}`);
  const b64 = rb?.Data;
  if (!b64) throw new Error("empty query response");
  const decoded = JSON.parse(atob(b64));
  if (decoded["@error"]) throw new Error(decoded["@error"]);
  return decoded.results ?? [];
}

// Decode an "N" field: base64 little-endian int64. Our values are small
// (scores, counts, 0/1 bools), so the low 32 bits are enough.
function decodeN(b64) {
  const bin = atob(b64);
  let n = 0;
  for (let i = Math.min(bin.length, 4) - 1; i >= 0; i--) {
    n = n * 256 + bin.charCodeAt(i);
  }
  return n;
}

function isBoolType(t) {
  return t?.["@type"] === "/gno.PrimitiveType" && t?.value === "4";
}

function isSliceType(t) {
  return t?.["@type"] === "/gno.SliceType";
}

// Unwrap one qeval_json result to a plain JS value.
function unwrap(tv) {
  if (!tv) return null;
  if (tv.N !== undefined && tv.N !== null) {
    const n = decodeN(tv.N);
    return isBoolType(tv.T) ? n !== 0 : n;
  }
  const v = tv.V;
  if (v === undefined || v === null) {
    if (isBoolType(tv.T)) return false;
    if (isSliceType(tv.T)) return [];
    return 0; // numeric or string zero value
  }
  if (v["@type"] === "/gno.StringValue") return v.value ?? "";
  if (v["@type"] === "/gno.SliceValue") {
    const list = v.Base?.List ?? [];
    return list.map((el) => unwrap(el));
  }
  // PointerValue and anything else: no usable data here.
  return null;
}

function num(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scoreCell(score) {
  const s = num(score);
  const cls = s >= 75 ? "good" : s >= 50 ? "ok" : "bad";
  return `<span class="score ${cls}">${s}</span>`;
}

function shortPath(p) {
  return p.replace("gno.land/r/", "r/");
}

let cache = { paths: [], latest: new Map(), counts: new Map() };

// Fetch one review's fields via field-access qeval. `base` is e.g.
// `LatestAgentReview("...")` or `GetReview("...", 1)`.
async function fetchReviewFields(base, fields) {
  const results = await Promise.all(fields.map((f) => qeval(`${base}.${f}`)));
  const out = {};
  fields.forEach((f, i) => {
    out[f] = unwrap(results[i][0]);
  });
  return out;
}

const HEADLINE_FIELDS = ["Score", "Docs", "Tests", "Safety", "Quality"];
const DETAIL_FIELDS = [
  "Version",
  "Score",
  "Docs",
  "Tests",
  "Safety",
  "Quality",
  "Verdict",
  "Checks",
  "Agent",
  "Reviewer",
];

async function loadBoard() {
  $("status-text").textContent = "Loading the board from the Onyx testnet…";
  $("status").hidden = false;
  $("stats").hidden = true;
  $("board").hidden = true;
  $("detail").hidden = true;

  const countRes = await qeval("ReviewCount()");
  const total = num(unwrap(countRes[0]));
  const pathsRes = await qeval("ReviewedPaths()");
  const paths = unwrap(pathsRes[0]) ?? [];
  cache.paths = Array.isArray(paths) ? paths : [];

  let sum = 0;
  let scored = 0;
  cache.latest = new Map();
  cache.counts = new Map();
  await Promise.all(
    cache.paths.map(async (p) => {
      const [latest, countRes2] = await Promise.all([
        fetchReviewFields(`LatestAgentReview(${JSON.stringify(p)})`, HEADLINE_FIELDS),
        qeval(`VersionCount(${JSON.stringify(p)})`),
      ]);
      const count = num(unwrap(countRes2[0]));
      cache.latest.set(p, latest);
      cache.counts.set(p, count);
      sum += num(latest.Score);
      scored++;
    }),
  );

  $("stat-reviews").textContent = String(total);
  $("stat-realms").textContent = String(cache.paths.length);
  $("stat-avg").textContent = scored ? String(Math.round(sum / scored)) : "–";
  $("status").hidden = true;
  $("stats").hidden = false;
  $("board").hidden = false;
  renderTable();
}

function renderTable() {
  const tbody = $("realm-rows");
  tbody.innerHTML = "";
  $("empty").hidden = cache.paths.length !== 0;
  for (const p of cache.paths) {
    const latest = cache.latest.get(p);
    const tr = document.createElement("tr");
    tr.className = "row";
    tr.innerHTML = `
      <td><a href="${GNOWEB_URL}/${esc(p)}" target="_blank" rel="noopener">${esc(shortPath(p))}</a></td>
      <td>${latest ? scoreCell(latest.Score) : "—"}</td>
      <td>${latest ? num(latest.Docs) : "—"}</td>
      <td>${latest ? num(latest.Tests) : "—"}</td>
      <td>${latest ? num(latest.Safety) : "—"}</td>
      <td>${latest ? num(latest.Quality) : "—"}</td>
      <td>${cache.counts.get(p) ?? 0}</td>`;
    tr.addEventListener("click", (e) => {
      if (e.target.tagName === "A") return;
      showDetail(p);
    });
    tbody.appendChild(tr);
  }
}

async function showDetail(pkgPath) {
  $("detail-title").textContent = shortPath(pkgPath);
  $("detail-body").innerHTML = "<p class=\"muted\">Loading review history…</p>";
  $("detail").hidden = false;
  $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
  const count = cache.counts.get(pkgPath) ?? 0;
  const items = [];
  for (let v = count; v >= 1; v--) {
    try {
      const r = await fetchReviewFields(
        `GetReview(${JSON.stringify(pkgPath)}, ${v})`,
        DETAIL_FIELDS,
      );
      items.push(r);
    } catch (e) {
      items.push({ Version: v, Score: 0, Verdict: `failed to load: ${e.message}` });
    }
  }
  $("detail-body").innerHTML = items
    .map(
      (r) => `
    <article class="review">
      <h3>v${num(r.Version)} — ${scoreCell(r.Score)} / 100 ${r.Agent ? '<span class="badge">agent</span>' : '<span class="badge human">human</span>'}</h3>
      <p class="cats">Docs ${num(r.Docs)} · Tests ${num(r.Tests)} · Safety ${num(r.Safety)} · Quality ${num(r.Quality)}</p>
      <p>${esc(r.Verdict)}</p>
      ${r.Checks ? `<p class="checks"><code>${esc(r.Checks)}</code></p>` : ""}
      <p class="muted small">by ${esc(r.Reviewer)}</p>
    </article>`,
    )
    .join("");
}

async function init() {
  $("realm-path").textContent = REALM;
  $("board-link").href = `${GNOWEB_URL}/${REALM}`;
  $("refresh").addEventListener("click", () => {
    loadBoard().catch(showError);
  });
  $("detail-close").addEventListener("click", () => {
    $("detail").hidden = true;
  });
  try {
    await loadBoard();
  } catch (e) {
    showError(e);
  }
}

function showError(e) {
  $("status").hidden = false;
  $("status-text").innerHTML =
    `Could not load the board: ${esc(e.message)}<br>` +
    `<span class="muted">The board realm may still be waiting for the testnet package approver, ` +
    `or the RPC may be unreachable. Check the <a href="${GNOWEB_URL}/${REALM}" target="_blank" rel="noopener">realm page on gnoweb</a>.</span>`;
}

init();
