# Contributing to ReviewPilot AI

Small, reproducible improvements are welcome: a diff that exposes a missed
finding, a false positive, a clearer setup step, or a focused code fix.

## Start here

- **Report review quality:** include a minimal, sanitized diff, the review mode
  and provider, the actual finding, and what a reviewer should have noticed.
- **Improve documentation:** try the [quick start](./README.md#quick-start) from
  a fresh clone and clarify any step that blocks you.
- **Add a regression case:** inspect [evals/golden-cases.json](./evals/golden-cases.json)
  and the [evaluation guide](./evals/README.md). Include a concrete expected behavior.
- **Fix a bug:** describe the reproduction and keep the change focused on it.

Use [the issue templates](https://github.com/JohnImril/reviewpilot-ai/issues/new/choose)
for bugs, review-quality feedback, or feature proposals. For larger features,
open an issue to discuss scope before implementing. Small fixes can go straight
to a pull request. Do not include private code, credentials, or raw webhook payloads
in public reports; reduce the example to the behavior that matters.

## Development setup

Fork the repository, clone your fork, and create a branch from `master`.
Use Node.js 24 LTS and npm:

```bash
npm ci
git switch -c fix/describe-the-change
npm run dev
```

Mock mode needs no API keys or GitHub App credentials. See
[getting started](./docs/getting-started.md) for optional configuration.

## Where to make changes

| Area                                   | Start with                                                 |
| -------------------------------------- | ---------------------------------------------------------- |
| Dashboard and report UI                | `app/page.tsx`, `app/components/review-result.tsx`         |
| Diff parsing and line locations        | `lib/diff/parseDiff.ts`, `tests/parseDiff.test.ts`         |
| Mock findings and risk factors         | `lib/ai/mockReview.ts`, `tests/mockReview.test.ts`         |
| Model prompts and provider integration | `lib/ai/reviewPrompt.ts`, `lib/ai/openAIReviewProvider.ts` |
| Shared review contract                 | `lib/schemas/review.ts`, `lib/review/runReview.ts`         |
| GitHub App behavior                    | `lib/github/`, `app/api/github/webhook/route.ts`           |
| Bundled examples and evals             | `data/exampleDiffs.ts`, `evals/golden-cases.json`          |

## Check your change

For code changes, run the same checks as CI:

```bash
npm run format:check
npm run lint
npm run test
npm run eval:mock
npm run build
```

For documentation-only changes, check formatting, relative links, and the
commands or examples you changed. CI still runs the full workflow on PRs.
Format only the files you edited to keep unrelated changes out of your PR:

```bash
npx prettier README.md --write
```

Add a focused regression test when changing parsing, findings, schemas, or
webhook behavior. Keep automated tests deterministic and mock network requests.
Real-provider evals are opt-in, make network calls, and can incur charges; they
are not required for a contribution.

Useful additional commands:

| Command                                                 | Purpose                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run test:watch`                                    | Run Vitest in watch mode                                                                                       |
| `npm run eval:real`                                     | Run real-provider cases only when explicitly enabled; see the [eval guide](./evals/README.md)                  |
| `npm run github:webhook:test`                           | Send a signed fixture to a local server; see [setup](./docs/github-app-setup.md#5-local-signed-request-helper) |
| `npm run github:smoke -- --repo OWNER/REPO --pr NUMBER` | Check a live GitHub App installation with credentials; dry-run by default                                      |

## Open a pull request

Target `master`. Explain the problem, what changes for users, and how you
verified it. Include a screenshot for visible UI changes and a small input/output
example for review-behavior changes. Update setup or API documentation when the
behavior changes, and use the repository's pull request template.

Contributions are made under the repository's [MIT license](./LICENSE).
