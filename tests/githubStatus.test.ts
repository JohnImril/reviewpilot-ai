import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/github/status/route";

describe("GitHub status", () => {
	const original = { ...process.env };
	afterEach(() => {
		process.env = { ...original };
	});
	it("reports presence without claiming live validation", async () => {
		Object.assign(process.env, {
			GITHUB_APP_ID: "1",
			GITHUB_APP_PRIVATE_KEY: "key",
			GITHUB_WEBHOOK_SECRET: "secret",
			VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
		});
		const body = await (await GET()).json();
		expect(body).toMatchObject({
			configurationPresent: true,
			credentialsValidated: false,
			installationValidated: false,
			deploymentRevision: "abcdef123456",
		});
		expect(JSON.stringify(body)).not.toContain("secret");
	});
});
