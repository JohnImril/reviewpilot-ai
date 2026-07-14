export type GitHubIntegrationErrorCategory =
	| "invalid_webhook"
	| "github_authentication_error"
	| "github_api_error"
	| "diff_validation_error"
	| "review_provider_error"
	| "comment_publication_error";

export class GitHubIntegrationError extends Error {
	constructor(
		public readonly category: GitHubIntegrationErrorCategory,
		message: string,
		public readonly status: number,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "GitHubIntegrationError";
	}
}

export function safeErrorMessage(error: unknown) {
	if (error instanceof GitHubIntegrationError) return error.message;
	return error instanceof Error
		? error.message
		: "Unexpected integration error.";
}
