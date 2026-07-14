import { createHmac, timingSafeEqual } from "node:crypto";

const signaturePattern = /^sha256=([a-f0-9]{64})$/i;

export function verifyWebhookSignature(input: {
	rawBody: string;
	signature: string | null;
	secret: string;
}): boolean {
	const { rawBody, signature, secret } = input;
	if (!secret || !signature) return false;

	const match = signature.match(signaturePattern);
	if (!match) return false;

	const provided = Buffer.from(match[1], "hex");
	const expected = createHmac("sha256", secret)
		.update(rawBody, "utf8")
		.digest();
	if (provided.length !== expected.length) return false;

	return timingSafeEqual(provided, expected);
}
