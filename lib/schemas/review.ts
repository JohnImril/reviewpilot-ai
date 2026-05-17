import { z } from "zod";

export const severitySchema = z.enum(["low", "medium", "high"]);

export const reviewModeSchema = z.enum([
	"general",
	"react",
	"typescript",
	"performance",
]);

export const reviewIssueSchema = z.object({
	title: z.string().min(1),
	severity: severitySchema,
	location: z
		.object({
			filePath: z.string().min(1),
			lineNumber: z.number().int().positive().optional(),
			codeSnippet: z.string().min(1).optional(),
		})
		.optional(),
	description: z.string().min(1),
	suggestedFix: z.string().min(1),
});

export const riskFactorSchema = z.object({
	label: z.string().min(1),
	impact: z.number().int().nonnegative(),
	severity: severitySchema,
	reason: z.string().min(1),
});

export const changedFileSchema = z.object({
	filePath: z.string().min(1),
	language: z.string().min(1),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	riskLevel: severitySchema,
});

export const reviewRequestSchema = z.object({
	diff: z.string().trim().min(1, "A git diff is required.").max(120_000),
	mode: reviewModeSchema.default("general"),
});

export const reviewResponseSchema = z.object({
	summary: z.string().min(1),
	overallRisk: severitySchema,
	riskScore: z.number().int().min(0).max(100),
	riskFactors: z.array(riskFactorSchema),
	changedFiles: z.array(changedFileSchema),
	possibleBugs: z.array(reviewIssueSchema),
	refactoringSuggestions: z.array(reviewIssueSchema),
	testSuggestions: z.array(z.string().min(1)).min(1),
	mergeRecommendation: z.enum(["approve", "needs_changes", "reject"]),
	confidence: z.number().min(0).max(1),
});

export const ReviewResultSchema = reviewResponseSchema;

export type Severity = z.infer<typeof severitySchema>;
export type ReviewMode = z.infer<typeof reviewModeSchema>;
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type ChangedFileSummary = z.infer<typeof changedFileSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
