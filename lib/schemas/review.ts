import { z } from "zod";

export const severitySchema = z.enum(["low", "medium", "high"]);

export const reviewIssueSchema = z.object({
  title: z.string().min(1),
  severity: severitySchema,
  description: z.string().min(1),
  suggestedFix: z.string().min(1),
});

export const reviewRequestSchema = z.object({
  diff: z.string().trim().min(1, "A git diff is required.").max(120_000),
});

export const reviewResponseSchema = z.object({
  summary: z.string().min(1),
  overallRisk: severitySchema,
  possibleBugs: z.array(reviewIssueSchema),
  refactoringSuggestions: z.array(reviewIssueSchema),
  testSuggestions: z.array(z.string().min(1)).min(1),
  mergeRecommendation: z.enum(["approve", "needs_changes", "reject"]),
  confidence: z.number().min(0).max(1),
});

export type Severity = z.infer<typeof severitySchema>;
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
