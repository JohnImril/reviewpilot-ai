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
	const startedAt = performance.now();
	const timings: Record<string, number> = {};
	let stageStarted = performance.now();
	const { owner } = payload.repository;
	const repo = payload.repository.name;
	const pullNumber = payload.pull_request.number;
	const access = await dependencies.authenticator.getInstallationToken(
		payload.installation.id,
	);
	timings.authentication = Math.round(performance.now() - stageStarted);
	const client = dependencies.createClient(access.token);
	let diff: string;
	try {
		stageStarted = performance.now();
		diff = await client.getPullRequestDiff({
			owner: owner.login,
			repo,
			pullNumber,
		});
		timings.fetch_diff = Math.round(performance.now() - stageStarted);
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
			stageStarted = performance.now();
			const review = await runReview(
				{ diff, mode: "general" },
				dependencies.reviewProvider,
			);
			timings.review = Math.round(performance.now() - stageStarted);
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

	timings.review ??= 0;
	const commentAction = await upsertReviewComment({
		client,
		appId: dependencies.appId,
		owner: owner.login,
		repo,
		pullNumber,
		body,
		onTiming: (stage, durationMs) => {
			timings[stage] = durationMs;
		},
	});
	timings.total = Math.round(performance.now() - startedAt);
	return {
		outcome,
		commentAction,
		fork: payload.pull_request.head?.repo?.fork ?? false,
		installation: {
			expiresAt: access.expiresAt,
			permissions: access.permissions,
			repositorySelection: access.repositorySelection,
		},
		timings,
	};
}

export function getMaxDiffChars(value = process.env.GITHUB_MAX_DIFF_CHARS) {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 100_000;
}
