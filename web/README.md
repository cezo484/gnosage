# GnoSage dashboard (week 2)

Static dashboard for the GnoSage review board. Reads the board realm on
the Onyx testnet via public RPC (`vm/qeval`, GET — no wallet needed to
browse). Users with the Adena wallet can post human reviews from the
realm page itself (week 3, if time allows).

## Data it shows

- Reviewed realms with latest agent scores (from `ReviewedPaths()` +
  `LatestAgentReview(path)` via `vm/qeval`).
- Score trends and the newest deployments awaiting review.
- Per-realm review history (`GetReview(path, version)`).

## Stack

Plain static HTML/CSS/JS, no build step, hosted on Vercel (hobby).
No animation libraries: the user explicitly excluded Motion from this
project (23 Nov 2026).

## Status

Built 23 Nov 2026: `index.html` + `app.js` + `style.css`, no build step.
Reads the board realm via `vm/qeval_json` (plain GET, CORS open on the
public RPC). Shows total reviews, realms reviewed, average agent score,
a sortable table of latest agent verdicts, and per-realm review history
on click. The board realm was deployed 23 Nov and is waiting for the
testnet auto-approver (enablement expected 10:04 TRT); the dashboard
shows a clear message until the realm is live.

Local preview: `python3 -m http.server 8123` in this directory, then
open http://localhost:8123/.
