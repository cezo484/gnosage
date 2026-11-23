# Check catalog

Deterministic static checks the GnoSage agent runs over a realm's source
before asking the LLM. Weights sum to 100; checks that do not apply are
excluded from the denominator.

| Check | Weight | What it looks for |
|---|---|---|
| has-tests | 20 | At least one `func Test...` in a `_test.gno` file. |
| has-docs | 10 | At least 3 doc comment lines in non-test source. |
| caller-checks | 25 | Exported mutating functions (`func X(cur realm)`) have caller assertions (`Previous().Address`, `IsUserCall`, `AssertOwnedBy`/`OwnedBy`). `na` when the realm has no exported mutating functions. |
| no-floats | 5 | No `float32`/`float64` types (determinism). |
| has-render | 10 | A `Render()` function (browsable on gnoweb). |
| has-errors | 10 | Named errors via `errors.New` instead of bare strings. |
| no-todo | 5 | No TODO/FIXME/XXX markers. |
| has-license | 5 | A license mention in source or a LICENSE file. |
| small-files | 10 | No single `.gno` file over 600 lines. |

## Scoring

- Static score = earned weight / applicable weight, 0-100.
- Final on-chain score = 60% static + 40% LLM score.
- The LLM's `tests` category score is capped at 30 when `has-tests` fails.
- The compact check list (`name:result;...`) is stored on-chain with each
  review, so anyone can audit what the agent saw.

## Planned checks (week 2-3)

- `gnovm-lint`: run `gno lint` on the fetched source in a temp module.
- `cross-realm-calls`: flag cross-realm calls without return-value checks.
- `coin-handling`: flag `Banker` sends without amount validation.
- `init-guards`: flag `init` functions that set ownership without a
  caller check.
