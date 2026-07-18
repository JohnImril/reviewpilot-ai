import { describe, expect, it } from "vitest";
import goldenCases from "@/evals/golden-cases.json";
import { OpenAIReviewProvider } from "@/lib/ai/openAIReviewProvider";
import type { ReviewMode } from "@/lib/schemas/review";

type GoldenCase = {
	id: string;
	mode: ReviewMode;
	diff: string;
	expectedFindings: {
		requiredIssueKeywords: string[];
		expectedRiskAtLeast: number;
	};
};
const enabled =
	process.env.RUN_REAL_PROVIDER_EVALS === "1" &&
	Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!enabled)("real provider golden evals", () => {
	const provider = new OpenAIReviewProvider();
	it.each(goldenCases as GoldenCase[])("$id", async (goldenCase) => {
		const review = await provider.reviewDiff(
			goldenCase.diff,
			goldenCase.mode,
		);
		const text = [...review.possibleBugs, ...review.refactoringSuggestions]
			.map((issue) =>
				[issue.title, issue.description, issue.suggestedFix].join(" "),
			)
			.join("\n")
			.toLowerCase();
		expect(review.riskScore).toBeGreaterThanOrEqual(
			goldenCase.expectedFindings.expectedRiskAtLeast,
		);
		for (const keyword of goldenCase.expectedFindings.requiredIssueKeywords)
			expect(text).toContain(keyword.toLowerCase());
	});
});
