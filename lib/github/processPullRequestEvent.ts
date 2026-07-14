import type { ReviewProvider } from "@/lib/ai/reviewProvider";
import { GitHubIntegrationError } from "@/lib/github/errors";
import {
	formatReviewComment,
	formatReviewNotice,
	upsertReviewComment,
} from "@/lib/github/githubReviewComment";
import type {
	GitHubAppAuthenticator,
	GitHubClient,
	PullRequestWebhook,
} from "@/lib/github/types";
import { runReview } from "@/lib/review/runReview";

export type ProcessPullRequestDependencies = {
	authenticator: GitHubAppAuthenticator;
	createClient: (installationToken: string) => GitHubClient;
	reviewProvider?: ReviewProvider;
	appId: number;
	maxDiffChars: number;
};

export async function processPullRequestEvent(
	payload: PullRequestWebhook,
	dependencies: ProcessPullRequestDependencies,
) {
	const { owner } = payload.repository;
	const repo = payload.repository.name;
	const pullNumber = payload.pull_request.number;
	const token = await dependencies.authenticator.getInstallationToken(
		payload.installation.id,
	);
	const client = dependencies.createClient(token);
	let diff: string;
	try {
		diff = await client.getPullRequestDiff({
			owner: owner.login,
			repo,
			pullNumber,
		});
	} catch (error) {
		if (error instanceof GitHubIntegrationError) throw error;
		throw new GitHubIntegrationError(
			"github_api_error",
			"Unable to fetch the pull request diff.",
			502,
			{ cause: error },
		);
	}

	let body: string;
	let outcome: "reviewed" | "empty_diff" | "diff_too_large";
	if (!diff.trim()) {
		outcome = "empty_diff";
		body = formatReviewNotice(
			"This pull request has no reviewable unified diff. It may contain no file changes or the diff may be unavailable.",
		);
	} else if (diff.length > dependencies.maxDiffChars) {
		outcome = "diff_too_large";
		body = formatReviewNotice(
			`This pull request diff is too large for the current MVP (${diff.length.toLocaleString("en-US")} characters; configured limit: ${dependencies.maxDiffChars.toLocaleString("en-US")}). No partial review was generated.`,
		);
	} else {
		outcome = "reviewed";
		try {
			const review = await runReview(
				{ diff, mode: "general" },
				dependencies.reviewProvider,
			);
			body = formatReviewComment(review);
		} catch (error) {
			throw new GitHubIntegrationError(
				"review_provider_error",
				"The configured review provider could not analyze this diff.",
				502,
				{ cause: error },
			);
		}
	}

	const commentAction = await upsertReviewComment({
		client,
		appId: dependencies.appId,
		owner: owner.login,
		repo,
		pullNumber,
		body,
	});
	return {
		outcome,
		commentAction,
		fork: payload.pull_request.head?.repo?.fork ?? false,
	};
}

export function getMaxDiffChars(value = process.env.GITHUB_MAX_DIFF_CHARS) {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 100_000;
}
