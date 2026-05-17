import { MockAIProvider } from "@/lib/ai/mockReview";
import { OpenAIReviewProvider } from "@/lib/ai/openAIReviewProvider";
import type { ReviewProvider } from "@/lib/ai/reviewProvider";

export type ReviewProviderName = "mock" | "openai";

export function getReviewProvider(): ReviewProvider {
	const providerName = process.env.AI_PROVIDER?.toLowerCase();

	if (providerName === "openai") {
		return new OpenAIReviewProvider();
	}

	return new MockAIProvider();
}
