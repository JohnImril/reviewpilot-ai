import { z } from "zod";

export const supportedPullRequestActions = [
	"opened",
	"reopened",
	"synchronize",
] as const;

export type SupportedPullRequestAction =
	(typeof supportedPullRequestActions)[number];

export const pullRequestWebhookSchema = z.object({
	action: z.enum(supportedPullRequestActions),
	installation: z.object({
		id: z.number().int().positive(),
	}),
	repository: z.object({
		name: z.string().min(1),
		full_name: z.string().min(1),
		owner: z.object({ login: z.string().min(1) }),
	}),
	pull_request: z.object({
		number: z.number().int().positive(),
		head: z
			.object({ repo: z.object({ fork: z.boolean() }).nullable() })
			.optional(),
	}),
});

export type PullRequestWebhook = z.infer<typeof pullRequestWebhookSchema>;

export type GitHubIssueComment = {
	id: number;
	body: string | null;
	user: { login: string; type: string } | null;
	performed_via_github_app: { id: number } | null;
};

export interface GitHubClient {
	getPullRequestDiff(input: {
		owner: string;
		repo: string;
		pullNumber: number;
	}): Promise<string>;
	listIssueComments(input: {
		owner: string;
		repo: string;
		issueNumber: number;
	}): Promise<GitHubIssueComment[]>;
	createIssueComment(input: {
		owner: string;
		repo: string;
		issueNumber: number;
		body: string;
	}): Promise<void>;
	updateIssueComment(input: {
		owner: string;
		repo: string;
		commentId: number;
		body: string;
	}): Promise<void>;
}

export interface GitHubAppAuthenticator {
	getInstallationToken(installationId: number): Promise<string>;
}

export interface DeliveryStore {
	begin(deliveryId: string): boolean;
	complete(deliveryId: string): void;
	fail(deliveryId: string): void;
}
