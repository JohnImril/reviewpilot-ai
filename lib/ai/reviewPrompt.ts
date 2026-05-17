import type { ParsedDiff } from "@/lib/diff/parseDiff";
import type { ReviewMode } from "@/lib/schemas/review";

export const reviewSystemPrompt = `You are ReviewPilot AI, a senior pull request review assistant.

Return strict JSON only. Do not wrap JSON in Markdown. Do not include prose outside the JSON object.
Review only changed behavior visible in the provided unified diff and parsed diff metadata.
Do not invent files, line numbers, code snippets, product requirements, dependencies, or repository context that are not present in the parsed diff.
Prefer concrete, location-aware findings over generic advice.`;

export const reviewJsonSchemaInstructions = `Return one JSON object matching this TypeScript-shaped contract:
{
  "summary": string,
  "overallRisk": "low" | "medium" | "high",
  "riskScore": number,
  "riskFactors": [
    {
      "label": string,
      "impact": number,
      "severity": "low" | "medium" | "high",
      "reason": string
    }
  ],
  "changedFiles": [
    {
      "filePath": string,
      "language": string,
      "additions": number,
      "deletions": number,
      "riskLevel": "low" | "medium" | "high"
    }
  ],
  "possibleBugs": [
    {
      "title": string,
      "severity": "low" | "medium" | "high",
      "location": {
        "filePath": string,
        "lineNumber": number,
        "codeSnippet": string
      },
      "description": string,
      "suggestedFix": string
    }
  ],
  "refactoringSuggestions": [
    {
      "title": string,
      "severity": "low" | "medium" | "high",
      "location": {
        "filePath": string,
        "lineNumber": number,
        "codeSnippet": string
      },
      "description": string,
      "suggestedFix": string
    }
  ],
  "testSuggestions": string[],
  "mergeRecommendation": "approve" | "needs_changes" | "reject",
  "confidence": number
}

Rules:
- riskScore must be an integer from 0 to 100.
- riskFactors must explain the score with impact points and short reasons.
- overallRisk must match riskScore: 0-34 is low, 35-69 is medium, 70-100 is high.
- confidence must be between 0 and 1.
- testSuggestions must include at least one actionable test suggestion.
- Location objects are optional, but when present they must use only file paths and new line numbers from parsedDiff.`;

const reviewModeGuidance: Record<ReviewMode, string> = {
	general:
		"General mode: prioritize correctness, maintainability, release risk, security-sensitive code, configuration, dependencies, and error handling.",
	react: "React mode: prioritize hooks, dependency arrays, rendering behavior, state updates, keys, props, effects, and component lifecycle risks.",
	typescript:
		"TypeScript mode: prioritize type safety, any usage, assertions, unknown data boundaries, API response contracts, and compiler suppressions.",
	performance:
		"Frontend Performance mode: prioritize render cost, avoidable allocations, inline props, expensive collection work, large lists, and derived state.",
};

export function buildReviewUserPrompt({
	diff,
	mode,
	parsedDiff,
}: {
	diff: string;
	mode: ReviewMode;
	parsedDiff: ParsedDiff;
}) {
	return `Review mode:
${reviewModeGuidance[mode]}

Risk scoring guidance:
- +10 for each medium issue.
- +20 for each high issue.
- +15 for package.json dependency or script changes.
- +15 for auth, security, config, payment, secret, token, or session file paths.
- +10 for large files with many additions.
- +20 for dangerouslySetInnerHTML or equivalent raw HTML injection risk.
- +10 for fetch or axios calls without clear nearby error handling.
- +8 for weak TypeScript typing with any.
- +5 for cleanup issues such as console.log or TODO.
- Cap riskScore at 100 and make riskFactors explain the contributing signals.

Location-aware review requirements:
- Use parsedDiff.files[].newPath for file paths.
- Use only new line numbers present on added lines in parsedDiff hunks.
- Include codeSnippet only when it appears in the diff.
- If a finding is pull-request-level and has no exact line, omit location.

${reviewJsonSchemaInstructions}

Parsed diff metadata:
${JSON.stringify(parsedDiff, null, 2)}

Unified diff:
${diff}`;
}

export const reviewPrompt = `${reviewSystemPrompt}

${reviewJsonSchemaInstructions}`;
