// CLI: `gnosage review <pkgPath> [--dry-run]` reviews one realm.
// `gnosage run [--dry-run]` reviews every path in queue.txt (one per line).
import { readFileSync, existsSync } from "node:fs";
import { reviewRealm } from "./review.js";

function usage(): never {
  console.log("usage: gnosage review <pkgPath> [--dry-run]");
  console.log("       gnosage run [--dry-run]        (reads queue.txt)");
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cmd = args.find((a) => !a.startsWith("--"));

  if (cmd === "review") {
    const pkgPath = args[args.indexOf("review") + 1];
    if (!pkgPath || pkgPath.startsWith("--")) usage();
    const out = await reviewRealm(pkgPath, dryRun);
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === "run") {
    if (!existsSync("queue.txt")) {
      console.log("queue.txt not found; nothing to review");
      return;
    }
    const paths = readFileSync("queue.txt", "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
    for (const p of paths) {
      try {
        await reviewRealm(p, dryRun);
      } catch (err) {
        console.error(`FAILED ${p}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
