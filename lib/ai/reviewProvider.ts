import type { ReviewResponse } from "@/lib/schemas/review";

export interface ReviewProvider {
  reviewDiff(diff: string): Promise<ReviewResponse>;
}
