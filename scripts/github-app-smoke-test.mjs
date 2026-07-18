import { createSign } from "node:crypto";
import { pathToFileURL } from "node:url";

export const USER_AGENT =
	"ReviewPilot-AI/0.1 (+https://github.com/JohnImril/reviewpilot-ai)";
const API = "https://api.github.com";
const MARKER = "<!-- reviewpilot-smoke-test -->";

export async function runSmoke({
	owner,
	repo,
	pr,
	publish = false,
	appId,
	privateKey,
	fetchImpl = fetch,
	output = console.log,
}) {
	const jwt = createJwt(appId, privateKey);
	const installation = await request(
		fetchImpl,
		`/repos/${owner}/${repo}/installation`,
		jwt,
	);
	const access = await request(
		fetchImpl,
		`/app/installations/${installation.id}/access_tokens`,
		jwt,
		{ method: "POST" },
	);
	const metadata = {
		installationId: installation.id,
		repositorySelection: access.repository_selection ?? "unknown",
		permissions: access.permissions ?? {},
		expiresAt: access.expires_at ?? "unknown",
		repositoryAccessible: false,
	};
	await request(fetchImpl, `/repos/${owner}/${repo}`, access.token);
	metadata.repositoryAccessible = true;
	const diffResponse = await requestResponse(
		fetchImpl,
		`/repos/${owner}/${repo}/pulls/${pr}`,
		access.token,
		{ headers: { Accept: "application/vnd.github.v3.diff" } },
	);
	const diff = await diffResponse.text();
	const comments = await request(
		fetchImpl,
		`/repos/${owner}/${repo}/issues/${pr}/comments?per_page=100`,
		access.token,
	);
	output(
		JSON.stringify(
			{
				...metadata,
				diffBytes: Buffer.byteLength(diff),
				commentCount: Array.isArray(comments) ? comments.length : 0,
				mode: publish ? "publish" : "dry-run",
			},
			null,
			2,
		),
	);
	if (!publish) return metadata;

	let canary;
	try {
		canary = await request(
			fetchImpl,
			`/repos/${owner}/${repo}/issues/${pr}/comments`,
			access.token,
			{
				method: "POST",
				body: JSON.stringify({
					body: `${MARKER}\nReviewPilot smoke test canary.`,
				}),
			},
		);
		await request(
			fetchImpl,
			`/repos/${owner}/${repo}/issues/comments/${canary.id}`,
			access.token,
			{
				method: "PATCH",
				body: JSON.stringify({
					body: `${MARKER}\nReviewPilot smoke test canary updated.`,
				}),
			},
		);
		await requestResponse(
			fetchImpl,
			`/repos/${owner}/${repo}/issues/comments/${canary.id}`,
			access.token,
			{ method: "DELETE" },
		);
		output(JSON.stringify({ publish: "created_updated_deleted" }));
	} catch (error) {
		if (canary?.id)
			output(
				`Cleanup may be required for comment ${canary.id}: ${canary.html_url ?? `https://github.com/${owner}/${repo}/pull/${pr}#issuecomment-${canary.id}`}`,
			);
		throw error;
	}
	return metadata;
}

function createJwt(appId, privateKey) {
	const now = Math.floor(Date.now() / 1000);
	const encode = (value) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
	return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).end().sign(privateKey.replace(/\\n/g, "\n"), "base64url")}`;
}

async function request(fetchImpl, path, token, init = {}) {
	const response = await requestResponse(fetchImpl, path, token, init);
	return response.status === 204 ? null : response.json();
}

async function requestResponse(fetchImpl, path, token, init = {}) {
	const response = await fetchImpl(`${API}${path}`, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": USER_AGENT,
			"X-GitHub-Api-Version": "2022-11-28",
			...init.headers,
		},
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const message =
			typeof body.message === "string"
				? body.message.slice(0, 300)
				: "GitHub API request failed";
		throw new Error(
			`${init.method ?? "GET"} ${path} failed (${response.status}): ${message}; request-id=${response.headers.get("x-github-request-id") ?? "unknown"}`,
		);
	}
	return response;
}

function parseArgs(argv) {
	const value = (flag) => argv[argv.indexOf(flag) + 1];
	const fullName = value("--repo")?.split("/");
	const pr = Number(value("--pr"));
	if (fullName?.length !== 2 || !Number.isSafeInteger(pr) || pr <= 0)
		throw new Error(
			"Usage: npm run github:smoke -- --repo OWNER/REPO --pr NUMBER [--publish]",
		);
	return {
		owner: fullName[0],
		repo: fullName[1],
		pr,
		publish: argv.includes("--publish"),
	};
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = parseArgs(process.argv.slice(2));
	if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY)
		throw new Error(
			"GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required.",
		);
	await runSmoke({
		...args,
		appId: process.env.GITHUB_APP_ID,
		privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
	});
}
