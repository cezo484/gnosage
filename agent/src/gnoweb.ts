// Reads realm sources from a Gno.land node over plain RPC (GET).
// Uses the vm/qfile ABCI query: with a bare package path it lists files,
// with a path + file name it returns the file's source.

export interface RealmSource {
  pkgPath: string;
  files: { name: string; content: string }[];
}

interface AbciQueryResult {
  jsonrpc: string;
  id: number;
  result?: {
    response?: {
      code?: number;
      log?: string;
      value?: string; // base64 (some endpoints)
      Value?: string; // base64 (alternate casing)
      ResponseBase?: {
        Error?: string | null;
        Data?: string; // base64 — the usual Tendermint shape
        Log?: string;
      };
    };
  };
  error?: { message: string };
}

async function abciQuery(rpcUrl: string, path: string, data: string): Promise<string> {
  const hex = Buffer.from(data, "utf8").toString("hex");
  const url = `${rpcUrl.replace(/\/$/, "")}/abci_query?path=%22${encodeURIComponent(path)}%22&data=0x${hex}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`RPC ${res.status} for ${path} ${data}`);
  const body = (await res.json()) as AbciQueryResult;
  if (body.error) throw new Error(`RPC error: ${body.error.message}`);
  const resp = body.result?.response;
  if (resp?.code) throw new Error(`query failed (${resp.code}): ${resp.log ?? ""}`);
  if (resp?.ResponseBase?.Error) throw new Error(`query failed: ${resp.ResponseBase.Error}`);
  const b64 = resp?.ResponseBase?.Data ?? resp?.value ?? resp?.Value;
  if (!b64) throw new Error(`empty response for ${path} ${data}`);
  return Buffer.from(b64, "base64").toString("utf8");
}

/** List the source files of a package. Returns [] when the package is missing. */
export async function listFiles(rpcUrl: string, pkgPath: string): Promise<string[]> {
  try {
    const out = await abciQuery(rpcUrl, "vm/qfile", pkgPath);
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Fetch one file's source. Returns null when the file is missing. */
export async function fetchFile(rpcUrl: string, pkgPath: string, file: string): Promise<string | null> {
  try {
    return await abciQuery(rpcUrl, "vm/qfile", `${pkgPath}/${file}`);
  } catch {
    return null;
  }
}

/** Fetch every .gno file of a realm (plus gnomod.toml when present). */
export async function fetchRealmSource(rpcUrl: string, pkgPath: string): Promise<RealmSource> {
  const names = await listFiles(rpcUrl, pkgPath);
  const wanted = names.filter((n) => n.endsWith(".gno") || n === "gnomod.toml");
  const files: { name: string; content: string }[] = [];
  for (const name of wanted) {
    const content = await fetchFile(rpcUrl, pkgPath, name);
    if (content !== null) files.push({ name, content });
  }
  return { pkgPath, files };
}
