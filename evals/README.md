# Golden Case Evals

Golden cases are small, curated diffs with expected review signals. They are not
full correctness proofs; they are regression checks for the most important
review behaviors the product should preserve.

AI review output needs evaluation because fluent text can look plausible while
missing the actual risk. For ReviewPilot AI, useful output should identify the
right issue category, preserve severity, point to changed files, and explain a
risk score that matches the diff.

`golden-cases.json` defines representative cases for React hooks, TypeScript
typing, raw HTML security risk, and missing network error handling. The
lightweight eval runner compares provider output against each case by checking:

- required issue keywords across possible bugs and refactoring suggestions
- required severities
- minimum expected `riskScore`
- expected changed files

The current script runs in mock mode only, so it is deterministic and safe for
local development and CI. It does not call OpenAI or require `OPENAI_API_KEY`.

Over time, these cases could evolve into automated LLM evals by running the
same cases against `OpenAIReviewProvider`, storing model outputs, tracking pass
rates, and adding human-reviewed rubrics for explanation quality. External LLM
evals should stay opt-in because they cost money, depend on network access, and
can be nondeterministic.
