import { MockReviewProvider } from "@/lib/ai/mockReview";
import {
  reviewRequestSchema,
  reviewResponseSchema,
} from "@/lib/schemas/review";

const provider = new MockReviewProvider();

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const { diff } = reviewRequestSchema.parse(body);
    const review = await provider.reviewDiff(diff);

    return Response.json(reviewResponseSchema.parse(review));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to analyze the provided diff.";

    return Response.json({ error: message }, { status: 400 });
  }
}
