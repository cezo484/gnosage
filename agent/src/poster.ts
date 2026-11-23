// Posts a review on-chain by shelling out to gnokey. The agent key is a
// throwaway testnet key in the local gnokey keybase; nothing here ever
// touches a mainnet key or a user wallet.
//
// gnokey needs the keybase password on stdin
// (-insecure-password-stdin); it comes from GNOKEY_PASSWORD.
//
// Two broadcast paths:
//   1. Direct: `gnokey maketx call` (compose + sign + broadcast in one
//      step). Works wherever gnokey can reach the RPC.
//   2. Split fallback: some sandboxed runners block gnokey's RPC client
//      (Go TLS handshake rejected by the egress proxy) while plain
//      HTTPS from curl/Node works fine. When the direct path fails with
//      a transport error, the poster falls back to:
//      maketx -broadcast=false -> gnokey sign (local, needs the account
//      number/sequence from a GET abci_query) -> txencode (amino JSON
//      to binary hex) -> broadcast_tx_commit via plain HTTPS POST.
//      The fallback needs AGENT_ADDRESS set and the `txencode` helper
//      on PATH (or TXENCODE_BIN pointing at it).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { LlmVerdict } from "./llm.js";

export interface PostResult {
  txHash: string;
  version: number | null;
}

function runCmd(
  cmd: string,
  args: string[],
  stdin: string,
  timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { timeout: timeoutMs });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr || stdout}`));
    });
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

function extractHash(out: string): string {
  return (
    out.match(/"hash":\s*"([0-9A-Fa-f]{64})"/)?.[1] ??
    out.match(/hash[=:]\s*([0-9A-Fa-f]{64})/)?.[1] ??
    ""
  );
}

function isTransportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("tls: first record does not look like a TLS handshake") ||
    msg.includes("unable to send request") ||
    msg.includes("connection refused") ||
    msg.includes("no such host")
  );
}

function baseArgs(cfg: Config): string[] {
  return [
    ...(cfg.gnokeyHome ? ["-home", cfg.gnokeyHome] : []),
    "-insecure-password-stdin",
  ];
}

async function postDirect(
  cfg: Config,
  args: string[],
  password: string,
): Promise<PostResult> {
  const { stdout, stderr } = await runCmd("gnokey", args, `${password}\n`);
  const hash = extractHash(`${stdout}\n${stderr}`);
  return { txHash: hash || "unknown", version: null };
}

interface RpcEnvelope {
  error?: { message: string };
  result?: {
    hash?: string;
    response?: { ResponseBase?: { Error?: unknown; Data?: string } };
    check_tx?: { ResponseBase?: { Error?: unknown; Log?: string } };
    deliver_tx?: { ResponseBase?: { Error?: unknown; Log?: string } };
  };
}

async function queryAccount(
  cfg: Config,
  address: string,
): Promise<{ number: string; sequence: string }> {
  const url = `${cfg.rpcUrl.replace(/\/$/, "")}/abci_query?path=auth/accounts/${address}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`account query HTTP ${res.status}`);
  const body = (await res.json()) as RpcEnvelope;
  const b64 = body.result?.response?.ResponseBase?.Data;
  if (!b64) throw new Error("account query returned no data");
  const account = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
    BaseAccount: { account_number: string; sequence: string };
  };
  return {
    number: account.BaseAccount.account_number,
    sequence: account.BaseAccount.sequence,
  };
}

async function postSplit(
  cfg: Config,
  callArgs: string[],
  password: string,
): Promise<PostResult> {
  const agentAddress = cfg.agentAddress;
  if (!agentAddress) {
    throw new Error("split-flow broadcast needs AGENT_ADDRESS set");
  }
  const txencode = cfg.txencodeBin || "txencode";
  const dir = mkdtempSync(join(tmpdir(), "gnosage-tx-"));
  try {
    // 1. Compose the unsigned tx (no RPC contact). The key name is the
    // last arg; flags must come before it. NOTE: -broadcast is a bool
    // flag, so it needs the `-broadcast=false` form — `-broadcast false`
    // leaves "false" as a stray positional arg and gnokey prints usage.
    const composeArgs = [
      ...callArgs.slice(0, -1),
      "-broadcast=false",
      callArgs[callArgs.length - 1],
    ];
    const { stdout } = await runCmd("gnokey", composeArgs, "");
    const unsignedPath = join(dir, "unsigned.json");
    writeFileSync(unsignedPath, stdout);

    // 2. Sign locally with the on-chain account number/sequence.
    const account = await queryAccount(cfg, agentAddress);
    const signedPath = join(dir, "signed.json");
    writeFileSync(signedPath, stdout);
    await runCmd(
      "gnokey",
      [
        "sign",
        "-tx-path",
        signedPath,
        "-account-number",
        account.number,
        "-account-sequence",
        account.sequence,
        "-chainid",
        cfg.chainId,
        ...baseArgs(cfg),
        cfg.agentKeyName,
      ],
      `${password}\n`,
    );

    // 3. Encode the signed amino JSON to binary hex.
    const { stdout: hex } = await runCmd(txencode, [signedPath], "");
    const txB64 = Buffer.from(hex.trim(), "hex").toString("base64");

    // 4. Broadcast over plain HTTPS JSON-RPC.
    const res = await fetch(cfg.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "gnosage-post",
        method: "broadcast_tx_commit",
        params: { tx: txB64 },
      }),
    });
    if (!res.ok) throw new Error(`broadcast HTTP ${res.status}`);
    const body = (await res.json()) as RpcEnvelope;
    if (body.error) throw new Error(`broadcast RPC error: ${body.error.message}`);
    const deliverErr = body.result?.deliver_tx?.ResponseBase?.Error;
    if (deliverErr) {
      throw new Error(
        `deliver_tx failed: ${JSON.stringify(deliverErr)} ${body.result?.deliver_tx?.ResponseBase?.Log ?? ""}`,
      );
    }
    const hashB64 = body.result?.hash;
    const hash = hashB64 ? Buffer.from(hashB64, "base64").toString("hex") : "";
    return { txHash: hash || "unknown", version: null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function postReview(
  cfg: Config,
  pkgPath: string,
  verdict: LlmVerdict,
  checksCompact: string,
  dryRun: boolean,
): Promise<PostResult> {
  const args = [
    "maketx",
    "call",
    "-pkgpath",
    cfg.realm,
    "-func",
    "PostReview",
    "-args",
    pkgPath,
    "-args",
    String(verdict.score),
    "-args",
    String(verdict.docs),
    "-args",
    String(verdict.tests),
    "-args",
    String(verdict.safety),
    "-args",
    String(verdict.quality),
    "-args",
    verdict.verdict,
    "-args",
    checksCompact,
    "-gas-fee",
    cfg.gasFee,
    "-gas-wanted",
    cfg.gasWanted,
    "-chainid",
    cfg.chainId,
    "-remote",
    cfg.rpcUrl,
    ...baseArgs(cfg),
    cfg.agentKeyName,
  ];
  if (dryRun) {
    console.log("[dry-run] gnokey", args.join(" "));
    return { txHash: "dry-run", version: null };
  }
  const password = process.env.GNOKEY_PASSWORD;
  if (!password) throw new Error("GNOKEY_PASSWORD is not set");
  try {
    return await postDirect(cfg, args, password);
  } catch (err) {
    if (!isTransportError(err)) throw err;
    console.log("[poster] direct broadcast failed (transport), using split flow");
    return await postSplit(cfg, args, password);
  }
}
