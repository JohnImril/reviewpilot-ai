import { afterEach, describe, expect, it, vi } from "vitest";
import { getReviewProvider } from "@/lib/ai/getReviewProvider";
import { MockAIProvider } from "@/lib/ai/mockReview";
import { OpenAIReviewProvider } from "@/lib/ai/openAIReviewProvider";
import { ReviewResultSchema } from "@/lib/schemas/review";
import { reactUseEffectDiff } from "./fixtures/react-use-effect.diff";

describe("review provider integration", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("uses MockAIProvider by default", () => {
		vi.stubEnv("AI_PROVIDER", "");

		expect(getReviewProvider()).toBeInstanceOf(MockAIProvider);
	});

	it("falls back to MockAIProvider for invalid AI_PROVIDER values", () => {
		vi.stubEnv("AI_PROVIDER", "unknown-provider");

		expect(getReviewProvider()).toBeInstanceOf(MockAIProvider);
	});

	it("uses OpenAIReviewProvider when AI_PROVIDER is openai", () => {
		vi.stubEnv("AI_PROVIDER", "openai");

		expect(getReviewProvider()).toBeInstanceOf(OpenAIReviewProvider);
	});

	it("rejects invalid LLM-like output with the ReviewResult schema", () => {
		const invalidOutput = {
			summary: "Looks fine",
			overallRisk: "critical",
			riskScore: 140,
			riskFactors: [],
			changedFiles: [],
			possibleBugs: [],
			refactoringSuggestions: [],
			testSuggestions: [],
			mergeRecommendation: "ship_it",
			confidence: 1.4,
		};

		expect(ReviewResultSchema.safeParse(invalidOutput).success).toBe(false);
	});

	it("OpenAIReviewProvider throws a clear error when OPENAI_API_KEY is missing", async () => {
		vi.stubEnv("OPENAI_API_KEY", "");
		const provider = new OpenAIReviewProvider();

		await expect(
			provider.reviewDiff(reactUseEffectDiff, "react"),
		).rejects.toThrow("OPENAI_API_KEY is not configured");
	});
});
