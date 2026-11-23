// Deterministic static checks over a realm's source. These do the heavy
// lifting: the LLM writes the verdict, but the checks decide most of the
// score, so two runs over the same code agree.
//
// Every check reports pass / fail / na (not applicable) plus a one-line
// note. The compact "name:result" list is stored on-chain with the review.
import type { RealmSource } from "./gnoweb.js";

export type CheckResult = "pass" | "fail" | "na";
export interface Check {
  name: string;
  result: CheckResult;
  note: string;
}

export interface CheckReport {
  checks: Check[];
  /** Compact on-chain form: "lint:pass;tests:fail;..." */
  compact: string;
  /** 0-100 score derived from the checks alone (fails weighted). */
  staticScore: number;
  totalLines: number;
  fileCount: number;
  testFiles: number;
}

const WEIGHTS: Record<string, number> = {
  "has-tests": 20,
  "has-docs": 10,
  "caller-checks": 25,
  "no-floats": 5,
  "has-render": 10,
  "has-errors": 10,
  "no-todo": 5,
  "has-license": 5,
  "small-files": 10,
};

function joinSource(src: RealmSource, testOnly = false): string {
  return src.files
    .filter((f) => (testOnly ? f.name.endsWith("_test.gno") : !f.name.endsWith("_test.gno")))
    .map((f) => f.content)
    .join("\n");
}

export function runChecks(src: RealmSource): CheckReport {
  const checks: Check[] = [];
  const code = joinSource(src);
  const tests = joinSource(src, true);
  const all = code + "\n" + tests;
  const gnoFiles = src.files.filter((f) => f.name.endsWith(".gno"));
  const testFiles = src.files.filter((f) => f.name.endsWith("_test.gno"));
  const totalLines = gnoFiles.reduce((n, f) => n + f.content.split("\n").length, 0);

  // has-tests: at least one _test.gno with at least one Test function.
  const testFns = (tests.match(/func Test\w+\(/g) ?? []).length;
  checks.push({
    name: "has-tests",
    result: testFns > 0 ? "pass" : "fail",
    note: testFns > 0 ? `${testFns} test function(s)` : "no test functions found",
  });

  // has-docs: a package doc comment or README-style header in the code.
  const hasDocs = /^\/\/\s+\S/m.test(code) && code.split("\n").filter((l) => l.trim().startsWith("//")).length >= 3;
  checks.push({
    name: "has-docs",
    result: hasDocs ? "pass" : "fail",
    note: hasDocs ? "doc comments present" : "fewer than 3 doc comment lines",
  });

  // caller-checks: exported mutating functions should check the caller.
  // Heuristic: count exported funcs taking `cur realm` and count caller
  // assertions (Previous().Address, IsUserCall, AssertOwnedBy, OwnedBy).
  const mutating = (code.match(/func [A-Z]\w*\(cur realm/g) ?? []).length;
  const assertions =
    (code.match(/Previous\(\)\.Address/g) ?? []).length +
    (code.match(/IsUserCall\(\)/g) ?? []).length +
    (code.match(/AssertOwnedBy|OwnedBy\(/g) ?? []).length;
  checks.push({
    name: "caller-checks",
    result: mutating === 0 ? "na" : assertions > 0 ? "pass" : "fail",
    note: mutating === 0 ? "no exported mutating functions" : `${assertions} caller assertion(s) for ${mutating} mutating function(s)`,
  });

  // no-floats: Gno determinism discourages floats; flag any float use.
  const floats = (all.match(/\bfloat(32|64)\b/g) ?? []).length;
  checks.push({
    name: "no-floats",
    result: floats === 0 ? "pass" : "fail",
    note: floats === 0 ? "no float types" : `${floats} float type use(s)`,
  });

  // has-render: a realm with a Render() function is browsable on gnoweb.
  const hasRender = /func Render\(/.test(code);
  checks.push({
    name: "has-render",
    result: hasRender ? "pass" : "fail",
    note: hasRender ? "Render() present" : "no Render() function",
  });

  // has-errors: named error values (errors.New) instead of bare strings.
  const namedErrors = (code.match(/errors\.New\(/g) ?? []).length;
  checks.push({
    name: "has-errors",
    result: namedErrors > 0 ? "pass" : "fail",
    note: namedErrors > 0 ? `${namedErrors} named error(s)` : "no errors.New calls",
  });

  // no-todo: leftover TODO/FIXME markers.
  const todos = (all.match(/TODO|FIXME|XXX/g) ?? []).length;
  checks.push({
    name: "no-todo",
    result: todos === 0 ? "pass" : "fail",
    note: todos === 0 ? "no TODO/FIXME markers" : `${todos} marker(s)`,
  });

  // has-license: a license note in the source or a LICENSE file.
  const hasLicense = /license/i.test(all) || src.files.some((f) => f.name.toLowerCase().startsWith("license"));
  checks.push({
    name: "has-license",
    result: hasLicense ? "pass" : "fail",
    note: hasLicense ? "license mentioned" : "no license found",
  });

  // small-files: no single file over 600 lines (readability proxy).
  const big = gnoFiles.filter((f) => f.content.split("\n").length > 600);
  checks.push({
    name: "small-files",
    result: big.length === 0 ? "pass" : "fail",
    note: big.length === 0 ? "all files under 600 lines" : `${big.length} file(s) over 600 lines`,
  });

  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.name] ?? 0;
    if (c.result === "na") continue;
    possible += w;
    if (c.result === "pass") earned += w;
  }
  const staticScore = possible === 0 ? 50 : Math.round((earned / possible) * 100);
  const compact = checks.map((c) => `${c.name}:${c.result}`).join(";");

  return { checks, compact, staticScore, totalLines, fileCount: gnoFiles.length, testFiles: testFiles.length };
}
