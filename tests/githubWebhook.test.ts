import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitHubWebhook } from "@/app/api/github/webhook/route";
import { InMemoryDeliveryStore } from "@/lib/github/deliveryStore";

const secret = "webhook-test-secret";
const validPayload = {
	action: "opened",
	installation: { id: 42 },
	repository: {
		name: "reviewpilot-ai",
		full_name: "example/reviewpilot-ai",
		owner: { login: "example" },
	},
	pull_request: { number: 7, head: { repo: { fork: false } } },
};

describe("GitHub webhook filtering and validation", () => {
	const processPullRequest = vi.fn(async () => ({ outcome: "reviewed" }));

	beforeEach(() => processPullRequest.mockClear());

	it("answers ping without running a review", async () => {
		const response = await send("ping", { zen: "hello" });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			status: "ok",
			event: "ping",
		});
		expect(processPullRequest).not.toHaveBeenCalled();
	});

	it.each(["opened", "reopened", "synchronize"])(
		"processes pull_request.%s",
		async (action) => {
			const response = await send("pull_request", {
				...validPayload,
				action,
			});
			expect(response.status).toBe(200);
			expect(processPullRequest).toHaveBeenCalledOnce();
		},
	);

	it("ignores unsupported pull request actions", async () => {
		const response = await send("pull_request", {
			...validPayload,
			action: "closed",
		});
		expect(await response.json()).toMatchObject({ status: "ignored" });
		expect(processPullRequest).not.toHaveBeenCalled();
	});

	it("ignores unsupported events", async () => {
		const response = await send("issues", { action: "opened" });
		expect(await response.json()).toMatchObject({
			status: "ignored",
			reason: "unsupported_event",
		});
	});

	it.each([
		["installation id", { ...validPayload, installation: undefined }],
		["repository", { ...validPayload, repository: undefined }],
		["PR number", { ...validPayload, pull_request: {} }],
	])("rejects a payload missing %s", async (_label, payload) => {
		const response = await send("pull_request", payload);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			category: "invalid_webhook",
		});
	});

	it("rejects malformed JSON", async () => {
		const response = await sendRaw("pull_request", "{not-json");
		expect(response.status).toBe(400);
	});

	it("rejects missing and invalid signatures", async () => {
		const missing = await sendRaw(
			"pull_request",
			JSON.stringify(validPayload),
			null,
		);
		const invalid = await sendRaw(
			"pull_request",
			JSON.stringify(validPayload),
			`sha256=${"0".repeat(64)}`,
		);
		expect(missing.status).toBe(401);
		expect(invalid.status).toBe(401);
	});

	it("suppresses a repeated delivery id", async () => {
		const store = new InMemoryDeliveryStore();
		const deliveryId = "same-delivery";
		const first = await send(
			"pull_request",
			validPayload,
			store,
			deliveryId,
		);
		const second = await send(
			"pull_request",
			validPayload,
			store,
			deliveryId,
		);
		expect(first.status).toBe(200);
		expect(await second.json()).toMatchObject({
			reason: "duplicate_delivery",
		});
		expect(processPullRequest).toHaveBeenCalledOnce();
	});

	function send(
		event: string,
		payload: unknown,
		store = new InMemoryDeliveryStore(),
		deliveryId = crypto.randomUUID(),
	) {
		return sendRaw(
			event,
			JSON.stringify(payload),
			undefined,
			store,
			deliveryId,
		);
	}

	function sendRaw(
		event: string,
		rawBody: string,
		signature: string | null | undefined = undefined,
		store = new InMemoryDeliveryStore(),
		deliveryId = crypto.randomUUID(),
	) {
		const headers = new Headers({
			"content-type": "application/json",
			"x-github-event": event,
			"x-github-delivery": deliveryId,
		});
		if (signature !== null) {
			headers.set(
				"x-hub-signature-256",
				signature ?? sign(rawBody, secret),
			);
		}
		return handleGitHubWebhook(
			new Request("http://localhost/api/github/webhook", {
				method: "POST",
				headers,
				body: rawBody,
			}),
			{ webhookSecret: secret, deliveryStore: store, processPullRequest },
		);
	}
});

function sign(body: string, webhookSecret: string) {
	return `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`;
}
