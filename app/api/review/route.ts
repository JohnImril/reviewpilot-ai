import { runReview } from "@/lib/review/runReview";
import { reviewRequestSchema } from "@/lib/schemas/review";

export async function POST(request: Request) {
	try {
		const body: unknown = await request.json();
		const { diff, mode } = reviewRequestSchema.parse(body);
		const review = await runReview({ diff, mode });

		return Response.json(review);
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Unable to analyze the provided diff.";

		return Response.json({ error: message }, { status: 400 });
	}
}
