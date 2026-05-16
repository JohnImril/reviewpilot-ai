import type { ReviewMode, ReviewResponse } from "@/lib/schemas/review";

export interface ReviewProvider {
  reviewDiff(diff: string, mode: ReviewMode): Promise<ReviewResponse>;
}
