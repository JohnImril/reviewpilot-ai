export type GitHubIntegrationErrorCategory =
	| "invalid_webhook"
	| "github_authentication_error"
	| "github_api_error"
	| "diff_validation_error"
	| "review_provider_error"
	| "comment_publication_error";

export type GitHubApiOperation = "create_comment" | "update_comment";

export type GitHubValidationError = {
	resource?: string;
	field?: string;
	code?: string;
};

export type GitHubApiDiagnostics = {
	method: string;
	path: string;
	responseStatus: number;
	requestId: string | null;
	acceptedPermissions: string | null;
	githubMessage: string;
	validationErrors?: GitHubValidationError[];
	operation?: GitHubApiOperation;
};

export class GitHubIntegrationError extends Error {
	constructor(
		public readonly category: GitHubIntegrationErrorCategory,
		message: string,
		public readonly status: number,
		options?: ErrorOptions & { github?: GitHubApiDiagnostics },
	) {
		super(message, options);
		this.name = "GitHubIntegrationError";
		this.github = options?.github;
	}

	public readonly github?: GitHubApiDiagnostics;
}

export function safeErrorMessage(error: unknown) {
	if (error instanceof GitHubIntegrationError) return error.message;
	return error instanceof Error
		? error.message
		: "Unexpected integration error.";
}
