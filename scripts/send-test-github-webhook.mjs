import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const fixturePath = new URL(
	"../tests/fixtures/github-pull-request-opened.json",
	import.meta.url,
);
const rawBody = await readFile(fixturePath, "utf8");
const secret = process.env.GITHUB_TEST_WEBHOOK_SECRET ?? "local-test-secret";
const endpoint =
	process.env.GITHUB_TEST_WEBHOOK_URL ??
	"http://localhost:3000/api/github/webhook";
const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

const response = await fetch(endpoint, {
	method: "POST",
	headers: {
		"content-type": "application/json",
		"x-github-event": "pull_request",
		"x-github-delivery": `local-${Date.now()}`,
		"x-hub-signature-256": signature,
	},
	body: rawBody,
});

console.log(`HTTP ${response.status}`);
console.log(await response.text());
