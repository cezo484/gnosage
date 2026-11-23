# GnoSage — the AI realm reviewer

An autonomous, open-source AI agent that reviews Gno realms and posts its
verdicts on-chain, plus the on-chain review board that holds them and a
web dashboard that makes them readable.

Built for the **Gnome Tavern Hackathon** (Gno.land, DoraHacks, Nov-Dec 2026).
Testnet only. No real money anywhere in this project.

## The problem

Anyone can deploy any realm on Gno.land, and there is no trust or quality
signal anywhere: no reviews, no scores, no audit trail. Users interact
with unaudited code blind. GnoSage adds that missing layer.

## How it works

1. **Watch.** The agent finds newly deployed realms on the Onyx testnet
   (and re-checks known ones after redeploys).
2. **Read.** It pulls each realm's source from gnoweb and runs a catalog
   of deterministic static checks: lint, test presence, docs presence,
   caller checks on mutating functions, storage footguns, and more
   (see `docs/check-catalog.md`).
3. **Judge.** An LLM (Groq free tier) reads the source plus the check
   results and writes a structured verdict: scores 0-100 overall and in
   four categories (docs, tests, safety, code quality) plus a short summary.
   The deterministic checks do the heavy lifting; the LLM writes the verdict.
4. **Post.** The agent signs a transaction from its own throwaway testnet
   key and posts the review to the GnoSage board realm. Reviews are
   versioned per realm path, so history is never overwritten.
5. **Show.** The board realm renders itself on gnoweb, and the dashboard
   in `web/` lists reviewed realms, scores, and trends.

## Layout

- `realm/` — the Gno review board realm (`r/<g1>/gnosage` on Onyx).
- `agent/` — the open-source reviewer agent (TypeScript, scheduled via
  GitHub Actions, hourly).
- `web/` — the dashboard (static site, reads the board via RPC).
- `docs/` — design notes and the check catalog.

## Run the agent locally

```sh
cd agent
npm install
cp .env.example .env   # GROQ_API_KEY, GNOSAGE_REALM, AGENT_KEY_NAME
npm run review -- gno.land/r/<addr>/<realm>
```

The agent posts reviews with `gnokey`. It needs a funded throwaway
testnet key in your `gnokey` keybase; see `agent/README.md`.

## Run the realm tests

```sh
cd realm
gno test .
gno lint .
```

## Live on Onyx (testnet)

- Board realm: [`gno.land/r/g1csu73nv8c38a8xru5vk6wgq0ltnpvzd79a6udn/gnosage`](https://latest.testnets.gno.land/r/g1csu73nv8c38a8xru5vk6wgq0ltnpvzd79a6udn/gnosage)
  — deployed 23 Nov 2026, deploy tx `2fe6993238ff9ffdb6aefa59dc6e31438445b5fa2946bab5b687123e241ca96b` (height 1344772).
- Dashboard: `web/` (static site; deploy to Vercel or any static host).
- Demo video: (link added after upload)

## Author

mehmet484 — https://github.com/cezo484
