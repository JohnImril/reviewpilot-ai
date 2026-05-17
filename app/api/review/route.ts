import { getReviewProvider } from "@/lib/ai/getReviewProvider";
import {
	reviewRequestSchema,
	reviewResponseSchema,
} from "@/lib/schemas/review";

export async function POST(request: Request) {
	try {
		const body: unknown = await request.json();
		const { diff, mode } = reviewRequestSchema.parse(body);
		const provider = getReviewProvider();
		const review = await provider.reviewDiff(diff, mode);

		return Response.json(reviewResponseSchema.parse(review));
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Unable to analyze the provided diff.";

		return Response.json({ error: message }, { status: 400 });
	}
}
