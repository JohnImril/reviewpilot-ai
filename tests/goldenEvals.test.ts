import { describe, expect, it } from "vitest";
import goldenCases from "@/evals/golden-cases.json";
import { MockAIProvider } from "@/lib/ai/mockReview";
import type { ReviewIssue, ReviewMode } from "@/lib/schemas/review";

type GoldenCase = {
	id: string;
	title: string;
	mode: ReviewMode;
	diff: string;
	expectedFindings: {
		requiredIssueKeywords: string[];
		requiredSeverities: Array<"low" | "medium" | "high">;
		expectedRiskAtLeast: number;
		expectedChangedFiles: string[];
	};
};

function formatIssueForSearch(issue: ReviewIssue) {
	return [
		issue.title,
		issue.severity,
		issue.description,
		issue.suggestedFix,
		issue.location?.filePath,
		issue.location?.codeSnippet,
	]
		.filter(Boolean)
		.join(" ");
}

describe("golden mock evals", () => {
	const provider = new MockAIProvider();

	it.each(goldenCases as GoldenCase[])("$id - $title", async (goldenCase) => {
		const review = await provider.reviewDiff(
			goldenCase.diff,
			goldenCase.mode,
		);
		const issues = [
			...review.possibleBugs,
			...review.refactoringSuggestions,
		];
		const issueText = issues
			.map(formatIssueForSearch)
			.join("\n")
			.toLowerCase();
		const severities = new Set(issues.map((issue) => issue.severity));
		const changedFiles = new Set(
			review.changedFiles.map((file) => file.filePath),
		);

		for (const keyword of goldenCase.expectedFindings
			.requiredIssueKeywords) {
			expect(issueText).toContain(keyword.toLowerCase());
		}

		for (const severity of goldenCase.expectedFindings.requiredSeverities) {
			expect(severities.has(severity)).toBe(true);
		}

		expect(review.riskScore).toBeGreaterThanOrEqual(
			goldenCase.expectedFindings.expectedRiskAtLeast,
		);

		for (const expectedFile of goldenCase.expectedFindings
			.expectedChangedFiles) {
			expect(changedFiles.has(expectedFile)).toBe(true);
		}
	});
});
