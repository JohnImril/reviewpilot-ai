import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/lib/ai/mockReview";
import { reviewResponseSchema } from "@/lib/schemas/review";
import { packageChangeDiff } from "./fixtures/package-change.diff";
import { reactUseEffectDiff } from "./fixtures/react-use-effect.diff";
import { securityRiskDiff } from "./fixtures/security-risk.diff";
import { typescriptAnyDiff } from "./fixtures/typescript-any.diff";

const provider = new MockAIProvider();

describe("MockAIProvider", () => {
	it("detects useEffect risk and includes file/line location", async () => {
		const review = await provider.reviewDiff(reactUseEffectDiff, "react");
		const issue = review.possibleBugs.find((bug) =>
			bug.title.includes("useEffect"),
		);

		expect(issue).toBeDefined();
		expect(issue?.location).toMatchObject({
			filePath: "app/components/UserSearch.tsx",
			lineNumber: 7,
			codeSnippet: "useEffect(() => {",
		});
	});

	it('detects TypeScript "any" usage and includes file/line location', async () => {
		const review = await provider.reviewDiff(
			typescriptAnyDiff,
			"typescript",
		);
		const issue = review.refactoringSuggestions.find((suggestion) =>
			suggestion.title.includes("TypeScript"),
		);

		expect(issue).toBeDefined();
		expect(issue?.location?.filePath).toBe("lib/services/reviewService.ts");
		expect(issue?.location?.lineNumber).toBe(6);
		expect(issue?.location?.codeSnippet).toContain("Promise<any>");
	});

	it("detects fetch or axios without clear error handling", async () => {
		const review = await provider.reviewDiff(reactUseEffectDiff, "react");
		const issue = review.possibleBugs.find((bug) =>
			bug.title.includes("Network request"),
		);

		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("medium");
		expect(issue?.location?.filePath).toBe("app/components/UserSearch.tsx");
		expect(issue?.location?.codeSnippet).toContain("fetch");
	});

	it("detects dangerouslySetInnerHTML as high risk", async () => {
		const review = await provider.reviewDiff(securityRiskDiff, "general");
		const issue = review.possibleBugs.find((bug) =>
			bug.title.includes("cross-site scripting"),
		);
		const factor = review.riskFactors.find((riskFactor) =>
			riskFactor.label.includes("Raw HTML"),
		);

		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("high");
		expect(factor).toMatchObject({
			impact: 20,
			severity: "high",
		});
		expect(review.mergeRecommendation).toBe("reject");
	});

	it("detects console.log or TODO cleanup issues", async () => {
		const review = await provider.reviewDiff(securityRiskDiff, "general");
		const cleanupIssues = review.refactoringSuggestions.filter(
			(suggestion) => suggestion.title.includes("Clean up"),
		);

		expect(cleanupIssues.length).toBeGreaterThanOrEqual(2);
		expect(cleanupIssues.every((issue) => issue.location?.filePath)).toBe(
			true,
		);
	});

	it("adds changedFiles summary", async () => {
		const review = await provider.reviewDiff(reactUseEffectDiff, "react");

		expect(review.changedFiles).toEqual([
			{
				filePath: "app/components/UserSearch.tsx",
				language: "TSX",
				additions: 10,
				deletions: 1,
				riskLevel: "medium",
			},
		]);
	});

	it("increases risk for package.json changes", async () => {
		const review = await provider.reviewDiff(packageChangeDiff, "general");

		expect(review.changedFiles[0]).toMatchObject({
			filePath: "package.json",
			riskLevel: "medium",
		});
		expect(
			review.riskFactors.some((factor) =>
				factor.label.includes("Dependency"),
			),
		).toBe(true);
		expect(
			review.refactoringSuggestions.some((issue) =>
				issue.title.includes("dependency"),
			),
		).toBe(true);
	});

	it("increases risk for auth/payment/security/config file paths", async () => {
		const review = await provider.reviewDiff(securityRiskDiff, "general");

		expect(review.changedFiles[0]).toMatchObject({
			filePath: "app/security/SafeHtml.tsx",
			riskLevel: "high",
		});
		expect(
			review.riskFactors.some((factor) =>
				factor.label.includes("Sensitive file paths"),
			),
		).toBe(true);
	});

	it("returns an explainable risk score and factors", async () => {
		const review = await provider.reviewDiff(reactUseEffectDiff, "react");

		expect(review.riskScore).toBeGreaterThanOrEqual(0);
		expect(review.riskScore).toBeLessThanOrEqual(100);
		expect(review.riskFactors.length).toBeGreaterThan(0);
	});

	it("scores high-risk inputs higher than low-risk inputs", async () => {
		const lowRiskDiff = `diff --git a/app/components/Label.tsx b/app/components/Label.tsx
index 1111111..2222222 100644
--- a/app/components/Label.tsx
+++ b/app/components/Label.tsx
@@ -1,3 +1,4 @@
 export function Label() {
+  const label = "Ready";
   return <span>Ready</span>;
 }`;
		const lowRiskReview = await provider.reviewDiff(lowRiskDiff, "general");
		const highRiskReview = await provider.reviewDiff(
			`${securityRiskDiff}\n${packageChangeDiff}`,
			"general",
		);

		expect(highRiskReview.riskScore).toBeGreaterThan(
			lowRiskReview.riskScore,
		);
		expect(highRiskReview.overallRisk).toBe("high");
	});

	it("maps overallRisk from riskScore ranges", async () => {
		const lowRiskReview = await provider.reviewDiff(
			packageChangeDiff,
			"general",
		);
		const mediumRiskReview = await provider.reviewDiff(
			securityRiskDiff,
			"general",
		);
		const highRiskReview = await provider.reviewDiff(
			`${securityRiskDiff}\n${packageChangeDiff}`,
			"general",
		);

		expectRiskBand(lowRiskReview.riskScore, lowRiskReview.overallRisk);
		expectRiskBand(
			mediumRiskReview.riskScore,
			mediumRiskReview.overallRisk,
		);
		expectRiskBand(highRiskReview.riskScore, highRiskReview.overallRisk);
	});

	it("returns a valid ReviewResult matching the Zod schema", async () => {
		const review = await provider.reviewDiff(
			`${reactUseEffectDiff}\n${packageChangeDiff}`,
			"general",
		);

		expect(() => reviewResponseSchema.parse(review)).not.toThrow();
	});
});

function expectRiskBand(
	riskScore: number,
	overallRisk: "low" | "medium" | "high",
) {
	if (riskScore <= 34) {
		expect(overallRisk).toBe("low");
		return;
	}

	if (riskScore <= 69) {
		expect(overallRisk).toBe("medium");
		return;
	}

	expect(overallRisk).toBe("high");
}
