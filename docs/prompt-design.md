# Prompt Design

ReviewPilot AI includes a real prompt architecture while keeping mock mode as
the default. The optional OpenAI-compatible provider uses the prompt helpers in
`lib/ai/reviewPrompt.ts`; tests do not call external APIs.

## Prompt Structure

The prompt is split into:

- `reviewSystemPrompt`: stable reviewer role, strict JSON-only behavior, and
  guardrails against inventing files, line numbers, snippets, or requirements.
- `buildReviewUserPrompt`: request-specific content containing the selected
  review mode, risk scoring guidance, location rules, parsed diff metadata, and
  original unified diff.
- `reviewJsonSchemaInstructions`: the exact JSON object shape the model must
  return.

The provider sends both parsed diff metadata and the raw diff. The parsed
metadata gives the model reliable file paths, additions, deletions, hunks, and
new line numbers; the raw diff keeps the original code context available.

## Structured Output

The model is instructed to return one JSON object only:

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
	"possibleBugs": [],
	"refactoringSuggestions": [],
	"testSuggestions": ["string"],
	"mergeRecommendation": "approve | needs_changes | reject",
	"confidence": 0.8
}
```

Risk scoring instructions mirror the mock provider: score contributing factors,
cap `riskScore` at 100, and map `0-34` to `low`, `35-69` to `medium`, and
`70-100` to `high`.

## Validation

`OpenAIReviewProvider` parses the model response as JSON and validates it with
`reviewResponseSchema` / `ReviewResultSchema` from `lib/schemas/review.ts`.
Invalid model output is rejected. The API route also validates the provider
result before returning JSON to the UI.

This keeps prompt output, provider behavior, API responses, and frontend
expectations aligned around one schema.

## Mock And Fallback Mode

`MockAIProvider` remains the default. `getReviewProvider()` reads
`AI_PROVIDER`; missing, `mock`, or invalid values return the mock provider.
`AI_PROVIDER=openai` enables the OpenAI-compatible provider.

Mock mode keeps the app safe for local demos, CI, portfolio review, and tests
without API keys or network calls.

## Failure Modes

OpenAI mode fails clearly when:

- `OPENAI_API_KEY` is missing.
- The OpenAI API returns an error.
- The model response has no JSON content.
- The model returns malformed JSON.
- The JSON does not match the ReviewPilot schema.

These failures return helpful API errors instead of silently accepting invalid
review data.
