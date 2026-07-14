import { ZodError } from "zod";
import { githubDeliveryStore } from "@/lib/github/deliveryStore";
import { GitHubIntegrationError, safeErrorMessage } from "@/lib/github/errors";
import {
	GitHubAppAuth,
	readGitHubAppCredentials,
} from "@/lib/github/githubAppAuth";
import { GitHubRestClient } from "@/lib/github/githubClient";
import {
	getMaxDiffChars,
	processPullRequestEvent,
} from "@/lib/github/processPullRequestEvent";
import {
	pullRequestWebhookSchema,
	supportedPullRequestActions,
	type DeliveryStore,
	type PullRequestWebhook,
} from "@/lib/github/types";
import { verifyWebhookSignature } from "@/lib/github/verifyWebhookSignature";

export const runtime = "nodejs";

type WebhookHandlerDependencies = {
	webhookSecret: string;
	deliveryStore: DeliveryStore;
	processPullRequest: (payload: PullRequestWebhook) => Promise<unknown>;
};

export async function handleGitHubWebhook(
	request: Request,
	dependencies: WebhookHandlerDependencies,
) {
	const event = request.headers.get("x-github-event");
	const deliveryId = request.headers.get("x-github-delivery");
	const signature = request.headers.get("x-hub-signature-256");
	const rawBody = await request.text();

	if (!event || !deliveryId) {
		return errorResponse(
			"invalid_webhook",
			"Required GitHub headers are missing.",
			400,
		);
	}
	if (!dependencies.webhookSecret) {
		return errorResponse(
			"invalid_webhook",
			"GitHub webhook verification is not configured.",
			500,
		);
	}
	if (
		!verifyWebhookSignature({
			rawBody,
			signature,
			secret: dependencies.webhookSecret,
		})
	) {
		return errorResponse(
			"invalid_webhook",
			"Webhook signature is invalid.",
			401,
		);
	}

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return errorResponse(
			"invalid_webhook",
			"Webhook body is not valid JSON.",
			400,
		);
	}

	if (event === "ping") {
		return Response.json({ status: "ok", event: "ping" });
	}
	if (event !== "pull_request") {
		return Response.json({
			status: "ignored",
			reason: "unsupported_event",
		});
	}

	const action =
		typeof body === "object" && body !== null && "action" in body
			? (body as { action?: unknown }).action
			: undefined;
	if (
		typeof action !== "string" ||
		!supportedPullRequestActions.includes(
			action as (typeof supportedPullRequestActions)[number],
		)
	) {
		return Response.json({
			status: "ignored",
			reason: "unsupported_pull_request_action",
		});
	}

	let payload: PullRequestWebhook;
	try {
		payload = pullRequestWebhookSchema.parse(body);
	} catch (error) {
		const detail =
			error instanceof ZodError
				? error.issues.map((issue) => issue.path.join(".")).join(", ")
				: "payload";
		return errorResponse(
			"invalid_webhook",
			`Webhook payload is missing required fields: ${detail}.`,
			400,
		);
	}

	if (!dependencies.deliveryStore.begin(deliveryId)) {
		return Response.json({
			status: "ignored",
			reason: "duplicate_delivery",
		});
	}

	try {
		const result = await dependencies.processPullRequest(payload);
		dependencies.deliveryStore.complete(deliveryId);
		return Response.json({ status: "processed", result });
	} catch (error) {
		dependencies.deliveryStore.fail(deliveryId);
		const integrationError =
			error instanceof GitHubIntegrationError
				? error
				: new GitHubIntegrationError(
						"github_api_error",
						"GitHub pull request processing failed.",
						500,
						{ cause: error },
					);
		console.error("ReviewPilot GitHub webhook failed", {
			deliveryId,
			event,
			repository: payload.repository.full_name,
			pullNumber: payload.pull_request.number,
			stage: integrationError.category,
			message: safeErrorMessage(integrationError),
		});
		return errorResponse(
			integrationError.category,
			integrationError.message,
			integrationError.status,
		);
	}
}

export async function POST(request: Request) {
	return handleGitHubWebhook(request, {
		webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
		deliveryStore: githubDeliveryStore,
		processPullRequest: (payload) => {
			const credentials = readGitHubAppCredentials();
			const appId = Number(credentials.appId);
			if (!Number.isSafeInteger(appId) || appId <= 0) {
				throw new GitHubIntegrationError(
					"github_authentication_error",
					"GITHUB_APP_ID must be a positive integer.",
					500,
				);
			}
			return processPullRequestEvent(payload, {
				authenticator: new GitHubAppAuth(credentials),
				createClient: (token) => new GitHubRestClient(token),
				appId,
				maxDiffChars: getMaxDiffChars(),
			});
		},
	});
}

function errorResponse(category: string, message: string, status: number) {
	return Response.json({ status: "error", category, message }, { status });
}
