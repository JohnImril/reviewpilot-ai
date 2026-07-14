import { getReviewProvider } from "@/lib/ai/getReviewProvider";
import type { ReviewProvider } from "@/lib/ai/reviewProvider";
import {
	type ReviewMode,
	type ReviewResponse,
	reviewResponseSchema,
} from "@/lib/schemas/review";

export type RunReviewInput = {
	diff: string;
	mode?: ReviewMode;
};

export async function runReview(
	{ diff, mode = "general" }: RunReviewInput,
	provider: ReviewProvider = getReviewProvider(),
): Promise<ReviewResponse> {
	const review = await provider.reviewDiff(diff, mode);

	return reviewResponseSchema.parse(review);
}
