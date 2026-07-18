import { createSign } from "node:crypto";
import { GitHubIntegrationError } from "@/lib/github/errors";
import type {
	GitHubAppAuthenticator,
	GitHubInstallationAccess,
} from "@/lib/github/types";

const GITHUB_API_URL = "https://api.github.com";
export const GITHUB_USER_AGENT =
	"ReviewPilot-AI/0.1 (+https://github.com/JohnImril/reviewpilot-ai)";

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

	async getInstallationToken(
		installationId: number,
	): Promise<GitHubInstallationAccess> {
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

		const payload: unknown = await response.json().catch(() => null);
		if (
			!response.ok ||
			!isObject(payload) ||
			typeof payload.token !== "string" ||
			!payload.token
		) {
			throw new GitHubIntegrationError(
				"github_authentication_error",
				`GitHub rejected the installation token request (${response.status}).`,
				502,
			);
		}
		return {
			token: payload.token,
			expiresAt: optionalString(payload.expires_at),
			permissions: stringRecord(payload.permissions),
			repositorySelection: optionalString(payload.repository_selection),
			repositoryIds: repositoryIds(payload.repositories),
		};
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
		"User-Agent": GITHUB_USER_AGENT,
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
function optionalString(value: unknown) {
	return typeof value === "string" ? value : undefined;
}
function stringRecord(value: unknown): Record<string, string> {
	if (!isObject(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}
function repositoryIds(value: unknown) {
	if (!Array.isArray(value)) return undefined;
	return value
		.map((item) => (isObject(item) ? item.id : undefined))
		.filter((id): id is number => Number.isSafeInteger(id));
}
