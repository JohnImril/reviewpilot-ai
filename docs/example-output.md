# Review API and example output

[Back to the README](../README.md)

`POST /api/review` accepts a unified git diff and returns a structured review.
It uses the server's configured provider: mock by default, or OpenAI when
enabled. Both providers return the same validated shape.

## Run the example

Start the app in mock mode using the [setup guide](./getting-started.md).
From the repository root, submit the complete
[sample request](./examples/react-review.request.json):

**macOS / Linux / Git Bash**

```bash
curl --fail-with-body http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  --data-binary @docs/examples/react-review.request.json
```

**PowerShell**

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/review -Method Post -ContentType "application/json" -InFile docs/examples/react-review.request.json
```

The file contains the first React example from
[`data/exampleDiffs.ts`](../data/exampleDiffs.ts), with leading and trailing
whitespace removed, and `"mode": "react"`. The dashboard's first **Load Example
Diff** selection runs the same input.

## Request fields

| Field  | Required | Accepted values                                                                        |
| ------ | -------- | -------------------------------------------------------------------------------------- |
| `diff` | Yes      | A string, trimmed and validated as nonempty; at most 120,000 characters after trimming |
| `mode` | No       | `general` (default), `react`, `typescript`, or `performance`                           |

The parser expects a unified diff with file headers and hunks, not a PR URL.
Modes change review emphasis; the mock provider uses pattern heuristics and
does not perform full semantic analysis.

| Mode          | Focus                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `general`     | General correctness, error handling, security signals, and change size |
| `react`       | React effects and component changes                                    |
| `typescript`  | Weak typing and typed boundaries                                       |
| `performance` | Render work, inline props, and array operations                        |

## Reproducible mock response

This response was generated from the sample request with `MockAIProvider`.
It includes both reported findings, their locations, and all test suggestions.

```json
{
	"summary": "ReviewPilot inspected 1 changed file with 11 additions and 1 deletion in React mode and found 2 possible bugs and 0 refactoring suggestions. Overall risk is low with a 30/100 score.",
	"overallRisk": "low",
	"riskScore": 30,
	"riskFactors": [
		{
			"label": "Medium-severity findings",
			"impact": 20,
			"severity": "medium",
			"reason": "2 medium review findings add correctness or maintainability risk."
		},
		{
			"label": "Missing network error handling",
			"impact": 10,
			"severity": "medium",
			"reason": "fetch or axios calls without nearby failure handling can leave loading, error, or data state inconsistent."
		}
	],
	"changedFiles": [
		{
			"filePath": "app/components/UserSearch.tsx",
			"language": "TSX",
			"additions": 11,
			"deletions": 1,
			"riskLevel": "medium"
		}
	],
	"possibleBugs": [
		{
			"title": "Verify useEffect dependencies",
			"severity": "medium",
			"location": {
				"filePath": "app/components/UserSearch.tsx",
				"lineNumber": 7,
				"codeSnippet": "useEffect(() => {"
			},
			"description": "This added effect should be checked for stale closures, incomplete dependencies, and repeated side effects.",
			"suggestedFix": "Confirm every value read inside the effect is represented in the dependency array or intentionally stable."
		},
		{
			"title": "Network request needs failure handling",
			"severity": "medium",
			"location": {
				"filePath": "app/components/UserSearch.tsx",
				"lineNumber": 9,
				"codeSnippet": "fetch(\"/api/users?query=\" + query)"
			},
			"description": "This request is added without nearby error handling. Non-2xx responses, rejected promises, or malformed payloads could leave the UI in an incorrect state.",
			"suggestedFix": "Add try/catch, check response status, and expose loading and failure states close to the request flow."
		}
	],
	"refactoringSuggestions": [],
	"testSuggestions": [
		"Add a React component test that verifies effects respond to changed inputs without unnecessary reruns.",
		"Mock successful and failed network responses to verify loading, success, and error states.",
		"Add or update tests for the primary user-visible behavior changed by this diff."
	],
	"mergeRecommendation": "needs_changes",
	"confidence": 0.88
}
```

A low overall score can still produce `needs_changes`: the recommendation also
accounts for individual finding severities. A file's risk level can differ
from the overall risk score. Confidence is a provider-generated value, not an
empirically calibrated probability.

## Response contract

The source of truth is
[`lib/schemas/review.ts`](../lib/schemas/review.ts). A successful response is the
review object itself, without a `data` wrapper.

| Field                                    | Meaning                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `summary`                                | Human-readable overview                                                          |
| `overallRisk`                            | `low`, `medium`, or `high`                                                       |
| `riskScore`                              | Integer from 0 to 100                                                            |
| `riskFactors`                            | Factors with a label, nonnegative integer impact, severity, and reason           |
| `changedFiles`                           | File paths, language labels, addition/deletion counts, and file risk levels      |
| `possibleBugs`, `refactoringSuggestions` | Findings with title, severity, description, suggested fix, and optional location |
| `testSuggestions`                        | At least one suggested test                                                      |
| `mergeRecommendation`                    | `approve`, `needs_changes`, or `reject`; advisory only                           |
| `confidence`                             | Number from 0 to 1                                                               |

A finding's optional location includes `filePath` and may include a positive
`lineNumber` and a `codeSnippet`. Zod validates structure and value ranges; it
does not verify whether a finding is correct or that a model's risk arithmetic
is consistent.

## Errors

The current route returns HTTP 400 with `{ "error": "..." }` for invalid input
**and** provider failures. Error text varies; callers should not depend on
exact wording. For example, a missing key in OpenAI mode returns:

```json
{
	"error": "OpenAI provider is selected but OPENAI_API_KEY is not configured. Set OPENAI_API_KEY or use AI_PROVIDER=mock."
}
```

The route rejects malformed request JSON, invalid modes, empty or oversized
input, provider failures, and invalid provider output. It does not silently
switch to mock after an OpenAI request fails.

The GitHub webhook uses a separate response and error contract. See
[GitHub App setup](./github-app-setup.md) for that workflow.
