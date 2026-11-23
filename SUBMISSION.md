# GnoSage — DoraHacks submission pack

Contest: Gnome Tavern (Gno.land on DoraHacks)
Submission deadline: 18 Dec 2026, 04:00 TRT
Results: 23 Dec 2026

## Project

- **Name:** GnoSage
- **Tagline:** AI reviews for Gno realms, on-chain.
- **Author:** mehmet484 (GitHub: cezo484) — no real name anywhere in the pack.
- **Cover image:** `cover.png` (2048x1152) — in this repo root.
- **Demo video:** https://youtu.be/S7pyfjSFpiQ (67.8s, 1280x720, narration + real on-chain data). Uploaded 23 Nov 2026 to Mehmet750 (unlisted). Local file: `demo/gnosage-demo.mp4`.

## What it is

An autonomous AI agent that reviews Gno realms and posts scored, versioned
verdicts on-chain, plus a review-board realm and a public dashboard.
Anyone can browse a realm's review history before trusting it.

## Categories (4 of 5)

- Best Open Source AI Agent
- Best Smart Contract
- Best UX
- Best DevTool

## Live on Onyx testnet (chain `onyx-1`)

- Board realm:
  https://latest.testnets.gno.land/r/g1csu73nv8c38a8xru5vk6wgq0ltnpvzd79a6udn/gnosage
- Deploy tx: `2fe6993238ff9ffdb6aefa59dc6e31438445b5fa2946bab5b687123e241ca96b`
  (height 1344772, 23 Nov 2026)
- Reviewer registration tx: `7a98ba1a16dd7457b4cace624099b6250df59ec557b7a5954c47f80ccdc7918e`
  (height 1345861) — agent key `g1gkfnfalpgqvazqa6exxvyz8m2any75gufq9kfz`
  registered; `IsReviewer` verified true on-chain.
- Dashboard: **https://gnosage-dashboard.vercel.app** (live, deployed 23 Nov 2026
  via Vercel CLI, project `mehmet-fb44/gnosage-dashboard`; static site from
  `web/`, HTTP 200 verified)
- Reviews on the board: **3** (all live, verified on gnoweb + qeval):
  - `gno.land/r/gnoland/blog` — **76** (20/70/80/70), tx `db7f0075d61fa1deee49378abfb7209b9e3a9104af6c56e5441f218eee3581ef`
  - `gno.land/r/g1gke74mu34h82s96tpwx6jqpf82aqgckq3r0xf8/home` — **74** (70/60/90/70), tx `c54163024e6ccf72bfd6fb8747ec10fa980c7114e08f7238760b12fae98c76d3`
  - `gno.land/r/gnoswap/order/dca` — **67** (80/0/70/75), tx `096ca17920a2a89bdbe1401199b0af4ef74d4455f634860055d809bec30dda6a`

## Repo

- https://github.com/cezo484/gnosage (to be created by the user; push this
  directory as-is — `.gitignore` keeps keys, `.env`, and node_modules out)
- License: MIT
- CI: hourly agent workflow (`.github/workflows/agent.yml`) — needs repo
  secrets GROQ_API_KEY, AGENT_MNEMONIC, GNOSAGE_REALM.

## Submission checklist

- [x] Realm deployed and enabled on Onyx
- [x] Agent registered as reviewer (RegisterReviewer tx, verified on-chain)
- [x] 3 live reviews on-chain (real Onyx realms)
- [x] Dashboard built + verified against live data (static, no build step)
- [x] Cover image (`cover.png`)
- [x] Demo video assembled (`demo/gnosage-demo.mp4`, 67.8s)
- [x] Demo video uploaded (YouTube): https://youtu.be/S7pyfjSFpiQ (Mehmet750, unlisted)
- [x] Dashboard deployed to a public URL — https://gnosage-dashboard.vercel.app
  (23 Nov 2026, verified HTTP 200)
- [ ] Repo created on GitHub (user) and pushed
- [ ] DoraHacks project page filled (parent + user confirm first)
