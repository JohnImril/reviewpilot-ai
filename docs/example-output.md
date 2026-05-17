# Example Output

`POST /api/review` accepts a git diff and a review mode. The current provider is
`MockAIProvider`, so responses are deterministic and available without network
access.

## Request

```json
{
	"diff": "diff --git a/app/components/UserSearch.tsx b/app/components/UserSearch.tsx\n...",
	"mode": "react"
}
```

## Review Modes

| Mode          | Focus                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| `general`     | Broad pull request risks, error handling, security-sensitive rendering, and large diffs.    |
| `react`       | `useEffect`, `useMemo`, `useCallback`, mapped JSX keys, and prop flow.                      |
| `typescript`  | `any`, `as` assertions, `@ts-ignore`, and missing explicit API response types.              |
| `performance` | Inline props, expensive array operations, large mapped lists, and duplicated derived state. |

## Response Shape

```json
{
	"summary": "string",
	"overallRisk": "low | medium | high",
	"riskScore": 0,
	"riskFactors": [
		{
			"label": "string",
			"impact": 0,
			"severity": "low | medium | high",
			"reason": "string"
		}
	],
	"changedFiles": [
		{
			"filePath": "string",
			"language": "string",
			"additions": 0,
			"deletions": 0,
			"riskLevel": "low | medium | high"
		}
	],
	"possibleBugs": [
		{
			"title": "string",
			"severity": "low | medium | high",
			"location": {
				"filePath": "string",
				"lineNumber": 1,
				"codeSnippet": "string"
			},
			"description": "string",
			"suggestedFix": "string"
		}
	],
	"refactoringSuggestions": [
		{
			"title": "string",
			"severity": "low | medium | high",
			"description": "string",
			"suggestedFix": "string"
		}
	],
	"testSuggestions": ["string"],
	"mergeRecommendation": "approve | needs_changes | reject",
	"confidence": 0.83
}
```

## Example Response

```json
{
	"summary": "ReviewPilot inspected 1 changed file with 10 additions and 1 deletion in React mode and found 2 possible bugs and 0 refactoring suggestions. Overall risk is low with a 30/100 score.",
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
			"additions": 10,
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
		}
	],
	"refactoringSuggestions": [],
	"testSuggestions": [
		"Add a React component test that verifies the effect reacts to changed inputs without running unnecessarily.",
		"Add or update tests for the primary user-visible behavior changed by this diff."
	],
	"mergeRecommendation": "needs_changes",
	"confidence": 0.83
}
```

## Validation Notes

The route validates requests with `reviewRequestSchema` before calling the
provider. It validates provider output with `reviewResponseSchema` before
returning JSON to the client. This same validation layer is the guardrail for a
future LLM provider.
