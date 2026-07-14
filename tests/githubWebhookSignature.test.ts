import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/github/verifyWebhookSignature";

describe("verifyWebhookSignature", () => {
	const secret = "local-test-secret";

	it("accepts a valid signature", () => {
		const rawBody = '{"zen":"Keep it logically awesome."}';
		expect(
			verifyWebhookSignature({
				rawBody,
				secret,
				signature: sign(rawBody, secret),
			}),
		).toBe(true);
	});

	it("accepts a valid signature for a Unicode raw body", () => {
		const rawBody = '{"message":"Привет, GitHub 👋"}';
		expect(
			verifyWebhookSignature({
				rawBody,
				secret,
				signature: sign(rawBody, secret),
			}),
		).toBe(true);
	});

	it.each([
		["invalid digest", `sha256=${"0".repeat(64)}`, secret],
		["missing signature", null, secret],
		["malformed signature", "sha1=abc", secret],
		["wrong-length digest", "sha256=abcd", secret],
		["empty secret", sign("{}", secret), ""],
	] as const)("rejects %s", (_label, signature, candidateSecret) => {
		expect(
			verifyWebhookSignature({
				rawBody: "{}",
				signature,
				secret: candidateSecret,
			}),
		).toBe(false);
	});
});

function sign(body: string, secret: string) {
	return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}
