import { createSign } from "node:crypto";
import { GitHubIntegrationError } from "@/lib/github/errors";
import type { GitHubAppAuthenticator } from "@/lib/github/types";

const GITHUB_API_URL = "https://api.github.com";

type FetchLike = typeof fetch;

export type GitHubAppCredentials = {
	appId: string;
	privateKey: string;
};

export function readGitHubAppCredentials(
	environment: NodeJS.ProcessEnv = process.env,
): GitHubAppCredentials {
	const appId = environment.GITHUB_APP_ID?.trim();
	const rawPrivateKey = environment.GITHUB_APP_PRIVATE_KEY?.trim();
	if (!appId || !rawPrivateKey) {
		throw new GitHubIntegrationError(
			"github_authentication_error",
			"GitHub App credentials are not configured.",
			500,
		);
	}
	return { appId, privateKey: rawPrivateKey.replace(/\\n/g, "\n") };
}

export function createGitHubAppJwt(
	credentials: GitHubAppCredentials,
	nowSeconds = Math.floor(Date.now() / 1000),
) {
	const header = encodeJson({ alg: "RS256", typ: "JWT" });
	const payload = encodeJson({
		iat: nowSeconds - 60,
		exp: nowSeconds + 9 * 60,
		iss: credentials.appId,
	});
	const unsignedToken = `${header}.${payload}`;
	try {
		const signature = createSign("RSA-SHA256")
			.update(unsignedToken)
			.end()
			.sign(credentials.privateKey, "base64url");
		return `${unsignedToken}.${signature}`;
	} catch (error) {
		throw new GitHubIntegrationError(
			"github_authentication_error",
			"GitHub App private key is invalid.",
			500,
			{ cause: error },
		);
	}
}

export class GitHubAppAuth implements GitHubAppAuthenticator {
	constructor(
		private readonly credentials: GitHubAppCredentials,
		private readonly fetchImpl: FetchLike = fetch,
	) {}

	async getInstallationToken(installationId: number): Promise<string> {
		const jwt = createGitHubAppJwt(this.credentials);
		let response: Response;
		try {
			response = await this.fetchImpl(
				`${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`,
				{
					method: "POST",
					headers: githubHeaders(jwt),
				},
			);
		} catch (error) {
			throw new GitHubIntegrationError(
				"github_authentication_error",
				"Unable to contact GitHub while creating an installation token.",
				502,
				{ cause: error },
			);
		}

		const payload = (await response.json().catch(() => null)) as {
			token?: string;
			message?: string;
		} | null;
		if (!response.ok || !payload?.token) {
			throw new GitHubIntegrationError(
				"github_authentication_error",
				`GitHub rejected the installation token request (${response.status}).`,
				502,
			);
		}
		return payload.token;
	}
}

function encodeJson(value: object) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function githubHeaders(jwt: string) {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${jwt}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}
