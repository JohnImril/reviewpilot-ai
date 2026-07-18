import { getReviewProviderName } from "@/lib/ai/getReviewProvider";

export async function GET() {
	const configurationPresent = Boolean(
		process.env.GITHUB_APP_ID?.trim() &&
		process.env.GITHUB_APP_PRIVATE_KEY?.trim() &&
		process.env.GITHUB_WEBHOOK_SECRET?.trim(),
	);
	return Response.json({
		configurationPresent,
		credentialsValidated: false,
		installationValidated: false,
		webhookEndpoint: "/api/github/webhook",
		supportedEvents: [
			"pull_request.opened",
			"pull_request.reopened",
			"pull_request.synchronize",
		],
		aiProvider: getReviewProviderName(),
		deploymentRevision: shortRevision(process.env.VERCEL_GIT_COMMIT_SHA),
		setupDocumentation:
			"https://github.com/JohnImril/reviewpilot-ai/blob/master/docs/github-app-setup.md",
	});
}

function shortRevision(value: string | undefined) {
	return value && /^[0-9a-f]{7,40}$/i.test(value.trim())
		? value.trim().slice(0, 12)
		: "unknown";
}
