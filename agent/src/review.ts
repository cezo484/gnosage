// One full review: fetch source, run static checks, ask the LLM, blend
// the scores, post on-chain, and verify the post landed.
//
// Score blending: the final score is 60% static checks + 40% LLM score.
// Category scores come from the LLM, except `tests`, which is capped by
// the has-tests check (no test functions means tests score <= 30).
import { loadConfig, requireReviewConfig } from "./config.js";
import { fetchRealmSource } from "./gnoweb.js";
import { runChecks } from "./checks.js";
import { judgeRealm, type LlmVerdict } from "./llm.js";
import { postReview } from "./poster.js";

export interface ReviewOutcome {
  pkgPath: string;
  staticScore: number;
  final: LlmVerdict;
  checksCompact: string;
  txHash: string;
  posted: boolean;
}

export async function reviewRealm(pkgPath: string, dryRun: boolean): Promise<ReviewOutcome> {
  const cfg = loadConfig();
  requireReviewConfig(cfg);

  console.log(`reviewing ${pkgPath} ...`);
  const src = await fetchRealmSource(cfg.rpcUrl, pkgPath);
  if (src.files.length === 0) throw new Error(`no source found for ${pkgPath}`);
  console.log(`  ${src.files.length} file(s) fetched`);

  const report = runChecks(src);
  console.log(`  static score ${report.staticScore}/100 (${report.compact})`);

  const llm = await judgeRealm(cfg.groqApiKey, cfg.groqModel, src, report);
  console.log(`  llm score ${llm.score}/100 — ${llm.verdict}`);

  const final: LlmVerdict = {
    ...llm,
    score: Math.round(report.staticScore * 0.6 + llm.score * 0.4),
    tests: report.checks.find((c) => c.name === "has-tests")?.result === "fail" ? Math.min(llm.tests, 30) : llm.tests,
  };
  console.log(`  final score ${final.score}/100`);

  const posted = await postReview(cfg, pkgPath, final, report.compact, dryRun);
  console.log(`  posted: ${posted.txHash}`);
  return { pkgPath, staticScore: report.staticScore, final, checksCompact: report.compact, txHash: posted.txHash, posted: !dryRun };
}
