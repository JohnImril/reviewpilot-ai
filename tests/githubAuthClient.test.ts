import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	GitHubAppAuth,
	createGitHubAppJwt,
	readGitHubAppCredentials,
} from "@/lib/github/githubAppAuth";
import { GitHubIntegrationError } from "@/lib/github/errors";
import { GitHubRestClient } from "@/lib/github/githubClient";

describe("GitHub App authentication", () => {
	it("normalizes escaped private-key newlines", () => {
		const credentials = readGitHubAppCredentials({
			GITHUB_APP_ID: "123",
			GITHUB_APP_PRIVATE_KEY: "line-1\\nline-2",
		});
		expect(credentials.privateKey).toBe("line-1\nline-2");
	});

	it("creates an RS256 app JWT and exchanges it for an installation token", async () => {
		const { privateKey, publicKey } = generateKeyPairSync("rsa", {
			modulusLength: 2048,
		});
		const credentials = {
			appId: "123",
			privateKey: privateKey
				.export({ type: "pkcs8", format: "pem" })
				.toString(),
		};
		const jwt = createGitHubAppJwt(credentials, 1_700_000_000);
		const [header, payload, signature] = jwt.split(".");
		expect(
			JSON.parse(Buffer.from(header, "base64url").toString()),
		).toMatchObject({
			alg: "RS256",
		});
		expect(
			JSON.parse(Buffer.from(payload, "base64url").toString()),
		).toMatchObject({
			iss: "123",
		});
		expect(
			verify(
				"RSA-SHA256",
				Buffer.from(`${header}.${payload}`),
				publicKey,
				Buffer.from(signature, "base64url"),
			),
		).toBe(true);

		const fetchMock = vi.fn(async () =>
			Response.json({ token: "installation-token" }, { status: 201 }),
		);
		const auth = new GitHubAppAuth(credentials, fetchMock as typeof fetch);
		expect(await auth.getInstallationToken(77)).toBe("installation-token");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/app/installations/77/access_tokens",
			expect.objectContaining({ method: "POST" }),
		);
		const headers = fetchMock.mock.calls[0][1]?.headers as Record<
			string,
			string
		>;
		expect(headers.Authorization).toMatch(/^Bearer ey/);
		expect(headers.Authorization).not.toContain("installation-token");
	});
});

describe("GitHub REST client", () => {
	it("requests the unified pull request diff with installation auth", async () => {
		const fetchMock = vi.fn(async () => new Response("diff --git a/a b/a"));
		const client = new GitHubRestClient(
			"secret-token",
			fetchMock as typeof fetch,
		);
		const diff = await client.getPullRequestDiff({
			owner: "example",
			repo: "repo",
			pullNumber: 12,
		});
		expect(diff).toContain("diff --git");
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Accept).toBe("application/vnd.github.v3.diff");
		expect(headers.Authorization).toBe("Bearer secret-token");
	});

	it("paginates issue comments until a short page", async () => {
		const firstPage = Array.from({ length: 100 }, (_, id) => ({
			id,
			body: null,
			user: null,
			performed_via_github_app: null,
		}));
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(Response.json(firstPage))
			.mockResolvedValueOnce(Response.json([firstPage[0]]));
		const client = new GitHubRestClient("token", fetchMock as typeof fetch);
		const comments = await client.listIssueComments({
			owner: "example",
			repo: "repo",
			issueNumber: 12,
		});
		expect(comments).toHaveLength(101);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][0]).toContain("page=2");
	});

	it.each([403, 404, 422])(
		"preserves safe create-comment diagnostics for GitHub %s",
		async (status) => {
			const fetchMock = vi.fn(async () =>
				Response.json(
					{
						message: `safe GitHub ${status}`,
						errors: [{ secret: "hidden" }],
					},
					{
						status,
						headers: {
							"x-github-request-id": `request-${status}`,
							"x-accepted-github-permissions": "issues=write",
						},
					},
				),
			);
			const client = new GitHubRestClient(
				"installation-secret",
				fetchMock as typeof fetch,
			);

			const promise = client.createIssueComment({
				owner: "example",
				repo: "repo",
				issueNumber: 12,
				body: "full private comment body",
			});
			const error = await promise.catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(GitHubIntegrationError);
			expect(error).toMatchObject({
				category: "comment_publication_error",
				status,
				message: `Unable to publish the ReviewPilot pull request comment (GitHub API ${status}).`,
				github: {
					method: "POST",
					path: "/repos/example/repo/issues/12/comments",
					responseStatus: status,
					requestId: `request-${status}`,
					acceptedPermissions: "issues=write",
					githubMessage: `safe GitHub ${status}`,
					operation: "create_comment",
				},
			});
			const diagnostics = JSON.stringify(error.github);
			expect(diagnostics).not.toContain("installation-secret");
			expect(diagnostics).not.toContain("full private comment body");
			expect(diagnostics).not.toContain("hidden");
		},
	);
});
