# Golden Case Evals

[Back to the README](../README.md)

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

## Run deterministic evals

```bash
npm run eval:mock
```

This runs `tests/goldenEvals.test.ts` using `MockAIProvider` directly, regardless
of `AI_PROVIDER`. It does not call OpenAI or require credentials, and it runs in CI.

## Run real-provider evals

An opt-in runner already exists in `tests/realProviderEvals.test.ts`. It sends
the same golden-case diffs to `OpenAIReviewProvider` and checks required issue
keywords and minimum risk scores. Unlike the mock runner, it does not currently
assert required severities or expected changed files.

Set `OPENAI_API_KEY` in your shell environment and optionally set `OPENAI_MODEL`
to a model available to your account. These Vitest tests do not automatically
load Next.js `.env.local` settings. Then explicitly enable the networked run:

**macOS / Linux / Git Bash**

```bash
RUN_REAL_PROVIDER_EVALS=1 npm run eval:real
```

**PowerShell**

```powershell
$env:RUN_REAL_PROVIDER_EVALS = "1"
try { npm run eval:real } finally { Remove-Item Env:RUN_REAL_PROVIDER_EVALS }
```

These requests incur provider usage and can produce different results across
runs. Without both `RUN_REAL_PROVIDER_EVALS=1` and a nonempty `OPENAI_API_KEY`,
the real-provider suite is **skipped**; a successful exit alone does not mean a
model was evaluated. Keep the flag unset during ordinary development and CI.

## Add a useful case

1. Reduce a bug or false positive to a small, sanitized unified diff.
2. Add a unique ID, title, mode, diff, and expected findings to
   [`golden-cases.json`](./golden-cases.json).
3. Specify expected issue keywords, severities, minimum risk score, and changed
   files. Use the existing cases as examples.
4. Run `npm run eval:mock` and explain the expected behavior in your PR. If the
   case exposes a current bug, include the fix or report the failing case in an issue.

The golden runner checks for required signals, not the absence of unwanted
findings. For false positives, add a focused negative assertion in
[`tests/mockReview.test.ts`](../tests/mockReview.test.ts).

These cases are regression checks, not an accuracy benchmark. A stronger
evaluation would add clean diffs, human-reviewed expected findings, precision
and recall measurements, and saved model outputs with model/version metadata.
