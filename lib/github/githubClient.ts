import { GitHubIntegrationError } from "@/lib/github/errors";
import type { GitHubClient, GitHubIssueComment } from "@/lib/github/types";

const GITHUB_API_URL = "https://api.github.com";
const COMMENTS_PER_PAGE = 100;
const MAX_COMMENT_PAGES = 10;
type FetchLike = typeof fetch;

export class GitHubRestClient implements GitHubClient {
	constructor(
		private readonly installationToken: string,
		private readonly fetchImpl: FetchLike = fetch,
	) {}

	async getPullRequestDiff(input: {
		owner: string;
		repo: string;
		pullNumber: number;
	}) {
		const response = await this.request(
			`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pullNumber}`,
			{ headers: { Accept: "application/vnd.github.v3.diff" } },
		);
		return response.text();
	}

	async listIssueComments(input: {
		owner: string;
		repo: string;
		issueNumber: number;
	}) {
		const comments: GitHubIssueComment[] = [];
		for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
			const response = await this.request(
				`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issueNumber}/comments?per_page=${COMMENTS_PER_PAGE}&page=${page}`,
			);
			const batch = (await response.json()) as GitHubIssueComment[];
			comments.push(...batch);
			if (batch.length < COMMENTS_PER_PAGE) break;
		}
		return comments;
	}

	async createIssueComment(input: {
		owner: string;
		repo: string;
		issueNumber: number;
		body: string;
	}) {
		await this.request(
			`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issueNumber}/comments`,
			{ method: "POST", body: JSON.stringify({ body: input.body }) },
		);
	}

	async updateIssueComment(input: {
		owner: string;
		repo: string;
		commentId: number;
		body: string;
	}) {
		await this.request(
			`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/comments/${input.commentId}`,
			{ method: "PATCH", body: JSON.stringify({ body: input.body }) },
		);
	}

	private async request(path: string, init: RequestInit = {}) {
		let response: Response;
		try {
			response = await this.fetchImpl(`${GITHUB_API_URL}${path}`, {
				...init,
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${this.installationToken}`,
					"Content-Type": "application/json",
					"X-GitHub-Api-Version": "2022-11-28",
					...init.headers,
				},
			});
		} catch (error) {
			throw new GitHubIntegrationError(
				"github_api_error",
				"Unable to contact the GitHub API.",
				502,
				{ cause: error },
			);
		}
		if (!response.ok) {
			const rateLimited =
				response.status === 429 ||
				(response.status === 403 &&
					response.headers.get("x-ratelimit-remaining") === "0");
			throw new GitHubIntegrationError(
				"github_api_error",
				rateLimited
					? "GitHub API rate limit prevented this review."
					: `GitHub API request failed (${response.status}).`,
				response.status === 404 ? 404 : 502,
			);
		}
		return response;
	}
}
