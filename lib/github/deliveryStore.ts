import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DeliveryStore } from "@/lib/github/types";

type DeliveryState = { status: "processing" | "complete"; expiresAt: number };
type DeliveryData = Record<string, DeliveryState>;

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
		for (const [key, value] of this.deliveries)
			if (value.expiresAt <= now) this.deliveries.delete(key);
		while (this.deliveries.size >= this.maxEntries) {
			const oldest = this.deliveries.keys().next().value as
				| string
				| undefined;
			if (!oldest) break;
			this.deliveries.delete(oldest);
		}
	}
}

export class FileDeliveryStore implements DeliveryStore {
	constructor(
		private readonly path: string,
		private readonly ttlMs = 24 * 60 * 60 * 1000,
	) {}
	begin(deliveryId: string) {
		const data = this.read();
		this.prune(data);
		if (data[deliveryId]) return false;
		data[deliveryId] = {
			status: "processing",
			expiresAt: Date.now() + this.ttlMs,
		};
		this.write(data);
		return true;
	}
	complete(deliveryId: string) {
		const data = this.read();
		data[deliveryId] = {
			status: "complete",
			expiresAt: Date.now() + this.ttlMs,
		};
		this.write(data);
	}
	fail(deliveryId: string) {
		const data = this.read();
		delete data[deliveryId];
		this.write(data);
	}
	private read(): DeliveryData {
		try {
			return JSON.parse(readFileSync(this.path, "utf8")) as DeliveryData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
			throw error;
		}
	}
	private write(data: DeliveryData) {
		mkdirSync(dirname(this.path), { recursive: true });
		const temporaryPath = this.path + ".tmp";
		writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
		renameSync(temporaryPath, this.path);
	}
	private prune(data: DeliveryData) {
		const now = Date.now();
		for (const [key, value] of Object.entries(data))
			if (value.expiresAt <= now) delete data[key];
	}
}

export function createDeliveryStore(
	environment: NodeJS.ProcessEnv = process.env,
): DeliveryStore {
	if (environment.GITHUB_DELIVERY_STORE_PATH && environment.VERCEL) {
		console.warn(
			"GITHUB_DELIVERY_STORE_PATH is ignored on Vercel: the file store is not safe for multi-instance serverless deployments.",
		);
		return new InMemoryDeliveryStore();
	}
	return environment.GITHUB_DELIVERY_STORE_PATH
		? new FileDeliveryStore(environment.GITHUB_DELIVERY_STORE_PATH)
		: new InMemoryDeliveryStore();
}

export const githubDeliveryStore = createDeliveryStore();
