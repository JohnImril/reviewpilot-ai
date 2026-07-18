import { describe, expect, it, vi } from "vitest";
import type { ReviewProvider } from "@/lib/ai/reviewProvider";
import { MockAIProvider } from "@/lib/ai/mockReview";
import { REVIEWPILOT_COMMENT_MARKER } from "@/lib/github/githubReviewComment";
import { GitHubIntegrationError } from "@/lib/github/errors";
import { processPullRequestEvent } from "@/lib/github/processPullRequestEvent";
import type {
	GitHubClient,
	GitHubIssueComment,
	PullRequestWebhook,
} from "@/lib/github/types";
import { reactUseEffectDiff } from "./fixtures/react-use-effect.diff";

const payload: PullRequestWebhook = {
	action: "opened",
	installation: { id: 42 },
	repository: {
		name: "reviewpilot-ai",
		full_name: "example/reviewpilot-ai",
		owner: { login: "example" },
	},
	pull_request: { number: 7, head: { repo: { fork: true } } },
};

describe("GitHub pull request orchestration", () => {
	it("gets a token and diff, runs the provider, and creates a comment", async () => {
		const client = new FakeGitHubClient(reactUseEffectDiff);
		const getInstallationToken = vi.fn(async () => ({
			token: "installation-token",
			permissions: {},
			repositorySelection: "selected",
		}));
		const reviewProvider = new MockAIProvider();
		const reviewSpy = vi.spyOn(reviewProvider, "reviewDiff");
		const createClient = vi.fn(() => client);

		const result = await processPullRequestEvent(payload, {
			authenticator: { getInstallationToken },
			createClient,
			reviewProvider,
			appId: 123,
			maxDiffChars: 100_000,
		});

		expect(getInstallationToken).toHaveBeenCalledWith(42);
		expect(createClient).toHaveBeenCalledWith("installation-token");
		expect(client.diffRequests).toEqual([
			{ owner: "example", repo: "reviewpilot-ai", pullNumber: 7 },
		]);
		expect(reviewSpy).toHaveBeenCalledWith(reactUseEffectDiff, "general");
		expect(client.created).toHaveLength(1);
		expect(client.created[0].body).toContain(REVIEWPILOT_COMMENT_MARKER);
		expect(result).toMatchObject({
			outcome: "reviewed",
			commentAction: "created",
			fork: true,
		});
	});

	it("updates an existing comment created by the same GitHub App", async () => {
		const client = new FakeGitHubClient(reactUseEffectDiff, [
			comment(99, 123, `${REVIEWPILOT_COMMENT_MARKER}\nold`),
		]);
		const result = await run(client);
		expect(result.commentAction).toBe("updated");
		expect(client.updated).toHaveLength(1);
		expect(client.updated[0].commentId).toBe(99);
		expect(client.created).toHaveLength(0);
	});

	it("does not edit a marker comment authored by another app", async () => {
		const client = new FakeGitHubClient(reactUseEffectDiff, [
			comment(99, 999, `${REVIEWPILOT_COMMENT_MARKER}\nforeign`),
		]);
		await run(client);
		expect(client.updated).toHaveLength(0);
		expect(client.created).toHaveLength(1);
	});

	it.each([false, true])(
		"preserves the original GitHubIntegrationError when %s comment fails",
		async (update) => {
			const client = new FakeGitHubClient(
				reactUseEffectDiff,
				update
					? [comment(99, 123, `${REVIEWPILOT_COMMENT_MARKER}\nold`)]
					: [],
			);
			const original = new GitHubIntegrationError(
				"comment_publication_error",
				"Unable to publish the ReviewPilot pull request comment (GitHub API 422).",
				422,
			);
			if (update) {
				client.updateIssueComment = vi.fn(async () => {
					throw original;
				});
			} else {
				client.createIssueComment = vi.fn(async () => {
					throw original;
				});
			}

			await expect(run(client)).rejects.toBe(original);
		},
	);

	it("publishes an empty-diff notice without running the provider", async () => {
		const provider = failingIfCalledProvider();
		const client = new FakeGitHubClient("  \n");
		const result = await run(client, provider);
		expect(result.outcome).toBe("empty_diff");
		expect(client.created[0].body).toContain("no reviewable unified diff");
	});

	it("publishes a too-large notice without truncating into the provider", async () => {
		const provider = failingIfCalledProvider();
		const client = new FakeGitHubClient("x".repeat(101));
		const result = await run(client, provider, 100);
		expect(result.outcome).toBe("diff_too_large");
		expect(client.created[0].body).toContain("too large");
		expect(client.created[0].body).toContain("No partial review");
	});

	it("uses mock mode without any OpenAI fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		await run(
			new FakeGitHubClient(reactUseEffectDiff),
			new MockAIProvider(),
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});

async function run(
	client: FakeGitHubClient,
	reviewProvider: ReviewProvider = new MockAIProvider(),
	maxDiffChars = 100_000,
) {
	return processPullRequestEvent(payload, {
		authenticator: {
			getInstallationToken: async () => ({
				token: "token",
				permissions: {},
			}),
		},
		createClient: () => client,
		reviewProvider,
		appId: 123,
		maxDiffChars,
	});
}

function failingIfCalledProvider(): ReviewProvider {
	return {
		reviewDiff: vi.fn(() => Promise.reject(new Error("must not run"))),
	};
}

function comment(id: number, appId: number, body: string): GitHubIssueComment {
	return {
		id,
		body,
		user: { login: "reviewpilot[bot]", type: "Bot" },
		performed_via_github_app: { id: appId },
	};
}

class FakeGitHubClient implements GitHubClient {
	diffRequests: Array<{ owner: string; repo: string; pullNumber: number }> =
		[];
	created: Array<{ body: string }> = [];
	updated: Array<{ commentId: number; body: string }> = [];

	constructor(
		private readonly diff: string,
		private readonly comments: GitHubIssueComment[] = [],
	) {}

	async getPullRequestDiff(input: {
		owner: string;
		repo: string;
		pullNumber: number;
	}) {
		this.diffRequests.push(input);
		return this.diff;
	}

	async listIssueComments() {
		return this.comments;
	}

	async createIssueComment(input: { body: string }) {
		this.created.push(input);
	}

	async updateIssueComment(input: { commentId: number; body: string }) {
		this.updated.push(input);
	}
}
