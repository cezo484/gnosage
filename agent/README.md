# GnoSage agent

The autonomous reviewer. Watches Gno.land realms, runs static checks,
asks an LLM (Groq, free tier) for a verdict, and posts scored reviews to
the GnoSage board realm on the Onyx testnet.

## Setup

```sh
npm install
cp .env.example .env
```

Fill in `.env`:

- `GROQ_API_KEY` — free key from https://console.groq.com/keys
- `GNOSAGE_REALM` — deployed board realm, e.g. `gno.land/r/g1.../gnosage`
- `AGENT_KEY_NAME` — gnokey key name for the agent's throwaway testnet key

Create the agent key (throwaway, testnet only) and fund it at
https://faucet.gno.land:

```sh
gnokey add gnosage-agent
gnokey query bank/balances/<g1-address> -remote https://rpc.latest.testnets.gno.land:443
```

The agent key must be registered as a reviewer on the board (owner runs
`RegisterReviewer` once), otherwise its reviews are stored as human
reviews and do not become headline verdicts.

## Run

```sh
npm run build
npm run review -- gno.land/r/<addr>/<realm> --dry-run   # no tx sent
npm run review -- gno.land/r/<addr>/<realm>             # posts on-chain
npm run run -- --dry-run                                # queue.txt paths
```

`queue.txt` (one realm path per line, `#` comments allowed) is the
week-1 discovery mechanism. The auto-discovering watcher (polling
AddPackage transactions) lands in week 2.

## Scheduled runs (GitHub Actions)

`.github/workflows/agent.yml` runs the agent hourly. Required repo secrets:

- `GROQ_API_KEY`
- `AGENT_MNEMONIC` — the 24-word mnemonic of the throwaway testnet key
  (testnet only; the key holds only faucet ugnot)
- `GNOSAGE_REALM`

The workflow installs `gnokey` via the official install script, imports
the key, builds the agent, and reviews `queue.txt`.

## Scoring

Final score = 60% deterministic static checks + 40% LLM score. Category
scores come from the LLM, except `tests`, which is capped at 30 when the
realm has no test functions. See `../docs/check-catalog.md` for the
check list and weights.
