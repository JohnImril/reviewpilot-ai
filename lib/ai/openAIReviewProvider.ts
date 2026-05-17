import { parseDiff } from "@/lib/diff/parseDiff";
import {
	buildReviewUserPrompt,
	reviewSystemPrompt,
} from "@/lib/ai/reviewPrompt";
import type { ReviewProvider } from "@/lib/ai/reviewProvider";
import {
	type ReviewMode,
	type ReviewResponse,
	reviewResponseSchema,
} from "@/lib/schemas/review";

const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

type OpenAIChatCompletionResponse = {
	choices?: Array<{
		message?: {
			content?: string | null;
		};
	}>;
	error?: {
		message?: string;
	};
};

export class OpenAIReviewProvider implements ReviewProvider {
	async reviewDiff(diff: string, mode: ReviewMode): Promise<ReviewResponse> {
		const apiKey = process.env.OPENAI_API_KEY?.trim();

		if (!apiKey) {
			throw new Error(
				"OpenAI provider is selected but OPENAI_API_KEY is not configured. Set OPENAI_API_KEY or use AI_PROVIDER=mock.",
			);
		}

		const parsedDiff = parseDiff(diff);
		const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
		const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "system",
						content: reviewSystemPrompt,
					},
					{
						role: "user",
						content: buildReviewUserPrompt({
							diff,
							mode,
							parsedDiff,
						}),
					},
				],
				response_format: { type: "json_object" },
			}),
		});

		const payload = (await response.json()) as OpenAIChatCompletionResponse;

		if (!response.ok) {
			throw new Error(
				`OpenAI review request failed: ${payload.error?.message ?? response.statusText}`,
			);
		}

		const content = payload.choices?.[0]?.message?.content;

		if (!content) {
			throw new Error(
				"OpenAI response did not include review JSON content.",
			);
		}

		const parsedJson = parseModelJson(content);
		const validation = reviewResponseSchema.safeParse(parsedJson);

		if (!validation.success) {
			throw new Error(
				`OpenAI response did not match the ReviewPilot schema: ${validation.error.issues
					.map(
						(issue) =>
							`${issue.path.join(".") || "root"} ${issue.message}`,
					)
					.join("; ")}`,
			);
		}

		return validation.data;
	}
}

function parseModelJson(content: string): unknown {
	try {
		return JSON.parse(content);
	} catch {
		throw new Error("OpenAI response was not valid JSON.");
	}
}
