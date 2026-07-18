import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { runSmoke, USER_AGENT } from "../scripts/github-app-smoke-test.mjs";

describe("GitHub App smoke orchestration", () => {
	it.each([false, true])("runs a safe publish=%s flow", async (publish) => {
		const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
			.privateKey.export({ type: "pkcs8", format: "pem" })
			.toString();
		const responses = [
			Response.json({ id: 42 }),
			Response.json({
				token: "installation-secret",
				repository_selection: "selected",
				permissions: { issues: "write", pull_requests: "read" },
				expires_at: "2030-01-01T00:00:00Z",
			}),
			Response.json({ id: 9 }),
			new Response("private full diff"),
			Response.json([]),
			...(publish
				? [
						Response.json({
							id: 8,
							html_url: "https://example.test/comment",
						}),
						Response.json({ id: 8 }),
						new Response(null, { status: 204 }),
					]
				: []),
		];
		const fetchMock = vi.fn(async () => responses.shift()!);
		const lines: string[] = [];
		await runSmoke({
			owner: "example",
			repo: "repo",
			pr: 7,
			publish,
			appId: "1",
			privateKey,
			fetchImpl: fetchMock as typeof fetch,
			output: (line: string) => lines.push(line),
		});
		expect(fetchMock).toHaveBeenCalledTimes(publish ? 8 : 5);
		for (const call of fetchMock.mock.calls)
			expect(
				(call[1]?.headers as Record<string, string>)["User-Agent"],
			).toBe(USER_AGENT);
		const output = lines.join("\n");
		expect(output).not.toContain("installation-secret");
		expect(output).not.toContain("private full diff");
		if (publish)
			expect(
				fetchMock.mock.calls.map((call) => call[1]?.method ?? "GET"),
			).toEqual([
				"GET",
				"POST",
				"GET",
				"GET",
				"GET",
				"POST",
				"PATCH",
				"DELETE",
			]);
	});
});
