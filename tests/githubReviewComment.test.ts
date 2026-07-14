import { describe, expect, it } from "vitest";
import {
	REVIEWPILOT_COMMENT_MARKER,
	escapeMarkdown,
	formatReviewComment,
} from "@/lib/github/githubReviewComment";
import type { ReviewResponse } from "@/lib/schemas/review";

const review: ReviewResponse = {
	summary: "A summary with # heading and <script>.",
	overallRisk: "medium",
	riskScore: 54,
	riskFactors: [],
	changedFiles: [],
	possibleBugs: [
		{
			title: "Verify [dependencies]",
			severity: "medium",
			location: {
				filePath: "app/components/UserSearch.tsx",
				lineNumber: 7,
			},
			description: "Potential *stale* value.",
			suggestedFix: "Add the missing dependency.",
		},
	],
	refactoringSuggestions: [
		{
			title: "Small cleanup",
			severity: "low",
			location: { filePath: "README.md" },
			description: "Clarify wording.",
			suggestedFix: "Rewrite it.",
		},
	],
	testSuggestions: ["Test success", "Test failure"],
	mergeRecommendation: "needs_changes",
	confidence: 0.83,
};

describe("GitHub review Markdown", () => {
	it("formats every report section and optional line numbers", () => {
		const markdown = formatReviewComment(review);
		expect(markdown).toContain(REVIEWPILOT_COMMENT_MARKER);
		expect(markdown).toContain("**Risk score:** 54/100");
		expect(markdown).toContain("`app/components/UserSearch.tsx`:7");
		expect(markdown).toContain("`README.md`");
		expect(markdown).toContain("### Refactoring suggestions");
		expect(markdown).toContain("- Test success");
	});

	it("renders empty issue and suggestion sections explicitly", () => {
		const markdown = formatReviewComment({
			...review,
			possibleBugs: [],
			refactoringSuggestions: [],
			testSuggestions: [],
		});
		expect(markdown).toContain("_None found by the configured provider._");
		expect(markdown).toContain("_No specific tests were suggested._");
	});

	it("escapes Markdown and HTML metacharacters", () => {
		expect(escapeMarkdown("# [x](url) <script> *bold*")).toBe(
			"\\# \\[x\\]\\(url\\) \\<script\\> \\*bold\\*",
		);
	});

	it("limits comment length while retaining its marker and disclaimer", () => {
		const markdown = formatReviewComment(
			{ ...review, summary: "long ".repeat(1_000) },
			500,
		);
		expect(markdown.length).toBeLessThanOrEqual(500);
		expect(markdown.startsWith(REVIEWPILOT_COMMENT_MARKER)).toBe(true);
		expect(markdown).toContain("Report shortened");
	});
});
