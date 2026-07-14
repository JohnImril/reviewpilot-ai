import { getReviewProviderName } from "@/lib/ai/getReviewProvider";

export async function GET() {
	const configured = Boolean(
		process.env.GITHUB_APP_ID?.trim() &&
		process.env.GITHUB_APP_PRIVATE_KEY?.trim() &&
		process.env.GITHUB_WEBHOOK_SECRET?.trim(),
	);
	return Response.json({
		githubAppConfigurationPresent: configured,
		webhookEndpoint: "/api/github/webhook",
		supportedEvents: [
			"pull_request.opened",
			"pull_request.reopened",
			"pull_request.synchronize",
		],
		aiProvider: getReviewProviderName(),
		setupDocumentation:
			"https://github.com/JohnImril/reviewpilot-ai/blob/master/docs/github-app-setup.md",
	});
}
