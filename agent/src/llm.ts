// Groq chat completions (OpenAI-compatible API). The LLM reads the
// realm source plus the deterministic check results and returns a
// structured verdict. Scores from the LLM are advisory: the final
// on-chain score blends them with the static check score (see review.ts).
import type { CheckReport } from "./checks.js";
import type { RealmSource } from "./gnoweb.js";

export interface LlmVerdict {
  score: number;
  docs: number;
  tests: number;
  safety: number;
  quality: number;
  verdict: string; // <= 1000 chars, plain text, no markdown links
}

const SYSTEM = [
  "You review Gno smart contracts (realms) on Gno.land. Gno is a deterministic Go dialect: no goroutines, no floats in critical paths, no reflect.",
  "Score the realm 0-100 overall and in four categories: docs, tests, safety, quality.",
  "Safety means: caller checks on mutating functions, no unguarded state changes, no footguns (unchecked arithmetic on money, missing validation).",
  "Be honest and specific. A hello-world counter is not a 90. A well-tested realm with caller checks and docs can be.",
  "Answer ONLY with a JSON object: {\"score\":N,\"docs\":N,\"tests\":N,\"safety\":N,\"quality\":N,\"verdict\":\"...\"}.",
  "The verdict is at most 3 short sentences, plain text, no markdown, no links, no em-dash.",
].join(" ");

const MAX_SOURCE_CHARS = 12000;

export async function judgeRealm(
  apiKey: string,
  model: string,
  src: RealmSource,
  report: CheckReport,
): Promise<LlmVerdict> {
  const source = src.files
    .map((f) => `=== ${f.name} ===\n${f.content}`)
    .join("\n")
    .slice(0, MAX_SOURCE_CHARS);
  const checkLines = report.checks.map((c) => `- ${c.name}: ${c.result} (${c.note})`).join("\n");
  const user = [
    `Realm: ${src.pkgPath}`,
    `Files: ${report.fileCount} (.gno), ${report.testFiles} test file(s), ${report.totalLines} lines.`,
    `Static check score: ${report.staticScore}/100.`,
    "Static checks:",
    checkLines,
    "",
    "Source:",
    source,
  ].join("\n");

  // gpt-oss-20b sometimes returns reasoning text instead of JSON, or a
  // truncated object. Ask for JSON mode and retry a few times; a failed
  // review here would otherwise drop the whole hourly run.
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content ?? "";
      return parseVerdict(content);
    } catch (err) {
      lastErr = err;
      console.log(`[llm] attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

function clamp(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

export function parseVerdict(content: string): LlmVerdict {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("LLM did not return JSON");
  const raw = JSON.parse(content.slice(start, end + 1)) as Partial<LlmVerdict>;
  const verdict = String(raw.verdict ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!verdict) throw new Error("LLM verdict was empty");
  return {
    score: clamp(raw.score, 50),
    docs: clamp(raw.docs, 50),
    tests: clamp(raw.tests, 50),
    safety: clamp(raw.safety, 50),
    quality: clamp(raw.quality, 50),
    verdict,
  };
}
