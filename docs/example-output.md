# Example Output

`POST /api/review` accepts a git diff and a review mode:

```json
{
  "diff": "diff --git a/app/components/UserSearch.tsx b/app/components/UserSearch.tsx\n...",
  "mode": "react"
}
```

| Mode          | Focus                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| `general`     | Broad pull request risks, error handling, security-sensitive rendering, and large diffs.    |
| `react`       | `useEffect`, `useMemo`, `useCallback`, mapped JSX keys, and prop flow.                      |
| `typescript`  | `any`, `as` assertions, `@ts-ignore`, and missing explicit API response types.              |
| `performance` | Inline props, expensive array operations, large mapped lists, and duplicated derived state. |

Example response:

```json
{
  "summary": "ReviewPilot inspected 13 changed lines across 1 file in React mode and found 1 possible bug and 0 refactoring suggestions. Overall risk is medium.",
  "overallRisk": "medium",
  "possibleBugs": [
    {
      "title": "Verify useEffect dependency behavior",
      "severity": "medium",
      "description": "React mode detected effect logic. Missing, stale, or unstable dependencies can cause repeated requests, stale state, or missed updates.",
      "suggestedFix": "Review the dependency array, memoize callback inputs only when needed, and add a regression test for the effect trigger conditions."
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
