import type { DeliveryStore } from "@/lib/github/types";

type DeliveryState = { status: "processing" | "complete"; expiresAt: number };

export class InMemoryDeliveryStore implements DeliveryStore {
	private readonly deliveries = new Map<string, DeliveryState>();

	constructor(
		private readonly ttlMs = 10 * 60 * 1000,
		private readonly maxEntries = 1_000,
	) {}

	begin(deliveryId: string) {
		this.prune();
		if (this.deliveries.has(deliveryId)) return false;
		this.deliveries.set(deliveryId, {
			status: "processing",
			expiresAt: Date.now() + this.ttlMs,
		});
		return true;
	}

	complete(deliveryId: string) {
		this.deliveries.set(deliveryId, {
			status: "complete",
			expiresAt: Date.now() + this.ttlMs,
		});
	}

	fail(deliveryId: string) {
		this.deliveries.delete(deliveryId);
	}

	private prune() {
		const now = Date.now();
		for (const [key, value] of this.deliveries) {
			if (value.expiresAt <= now) this.deliveries.delete(key);
		}
		while (this.deliveries.size >= this.maxEntries) {
			const oldest = this.deliveries.keys().next().value as
				| string
				| undefined;
			if (!oldest) break;
			this.deliveries.delete(oldest);
		}
	}
}

export const githubDeliveryStore = new InMemoryDeliveryStore();
