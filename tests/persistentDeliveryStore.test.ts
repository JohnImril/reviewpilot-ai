import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileDeliveryStore } from "@/lib/github/deliveryStore";

describe("persistent delivery store", () => {
	it("deduplicates deliveries across store instances", () => {
		const path = join(
			mkdtempSync(join(tmpdir(), "reviewpilot-")),
			"deliveries.json",
		);
		const first = new FileDeliveryStore(path);
		expect(first.begin("delivery-1")).toBe(true);
		first.complete("delivery-1");
		expect(new FileDeliveryStore(path).begin("delivery-1")).toBe(false);
		expect(
			JSON.parse(readFileSync(path, "utf8"))["delivery-1"].status,
		).toBe("complete");
	});
	it("releases failed deliveries for retry", () => {
		const path = join(
			mkdtempSync(join(tmpdir(), "reviewpilot-")),
			"deliveries.json",
		);
		const store = new FileDeliveryStore(path);
		expect(store.begin("delivery-2")).toBe(true);
		store.fail("delivery-2");
		expect(new FileDeliveryStore(path).begin("delivery-2")).toBe(true);
	});
});
