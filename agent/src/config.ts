// Config: everything comes from the environment. No defaults carry
// secrets; the agent refuses to run a review without a Groq key and a
// board realm path.
//
// A `.env` file in the working directory is loaded first (values already
// in the environment win over the file).
import { existsSync, readFileSync } from "node:fs";

export interface Config {
  groqApiKey: string;
  groqModel: string;
  rpcUrl: string;
  chainId: string;
  realm: string;
  agentKeyName: string;
  agentAddress: string;
  gnokeyHome: string;
  gasFee: string;
  gasWanted: string;
  txencodeBin: string;
}

export function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (process.env[key] === undefined) process.env[key] = value.trim();
  }
}

function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
}

export function loadConfig(): Config {
  loadDotEnv();
  return {
    groqApiKey: env("GROQ_API_KEY"),
    groqModel: env("GROQ_MODEL", "openai/gpt-oss-20b"),
    rpcUrl: env("RPC_URL", "https://rpc.latest.testnets.gno.land:443"),
    chainId: env("CHAIN_ID", "onyx-1"),
    realm: env("GNOSAGE_REALM"),
    agentKeyName: env("AGENT_KEY_NAME", "gnosage-agent"),
    agentAddress: env("AGENT_ADDRESS", ""),
    gnokeyHome: env("GNOKEY_HOME", ""),
    gasFee: env("GAS_FEE", "5000ugnot"),
    gasWanted: env("GAS_WANTED", "5000000"),
    txencodeBin: env("TXENCODE_BIN", ""),
  };
}

export function requireReviewConfig(cfg: Config): void {
  if (!cfg.groqApiKey) throw new Error("GROQ_API_KEY is not set");
  if (!cfg.realm) throw new Error("GNOSAGE_REALM is not set");
}
