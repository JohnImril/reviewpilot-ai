import { MockAIProvider } from "@/lib/ai/mockReview";
import { OpenAIReviewProvider } from "@/lib/ai/openAIReviewProvider";
import type { ReviewProvider } from "@/lib/ai/reviewProvider";

export type ReviewProviderName = "mock" | "openai";

export function getReviewProviderName(): ReviewProviderName {
	return process.env.AI_PROVIDER?.toLowerCase() === "openai"
		? "openai"
		: "mock";
}

export function getReviewProvider(): ReviewProvider {
	const providerName = getReviewProviderName();

	if (providerName === "openai") {
		return new OpenAIReviewProvider();
	}

	return new MockAIProvider();
}
