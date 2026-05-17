import type { Metadata } from "next";
import { AppNav } from "@/app/components/app-nav";
import { ReviewResult, reviewModeLabels } from "@/app/components/review-result";
import { exampleDiffs } from "@/data/exampleDiffs";
import { MockAIProvider } from "@/lib/ai/mockReview";

export const metadata: Metadata = {
	title: "Examples | ReviewPilot AI",
	description:
		"Prepared ReviewPilot AI review examples for React, TypeScript, and frontend performance pull request risks.",
};

export default async function ExamplesPage() {
	const provider = new MockAIProvider();
	const examples = await Promise.all(
		exampleDiffs.map(async (example) => ({
			...example,
			review: await provider.reviewDiff(
				example.diff.trim(),
				example.mode,
			),
		})),
	);

	return (
		<main className="min-h-screen bg-[#f6f5f2] text-zinc-950">
			<section className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
					<AppNav current="examples" />

					<div className="max-w-3xl">
						<p className="text-base leading-7 text-zinc-600 sm:text-lg">
							Browse prepared review outputs that show how
							ReviewPilot AI explains common pull request risks
							without real OpenAI integration, auth, a database,
							or external APIs.
						</p>
					</div>
				</div>
			</section>

			<section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
				{examples.map((example) => (
					<section
						key={example.title}
						className="grid gap-5 border-b border-zinc-200 pb-8 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]"
					>
						<div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
							<div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-zinc-500">
											Prepared example
										</p>
										<h2 className="mt-1 text-xl font-semibold text-zinc-950">
											{example.title}
										</h2>
									</div>
									<span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
										{reviewModeLabels[example.mode]} mode
									</span>
								</div>
								<p className="mt-3 text-sm leading-6 text-zinc-600">
									{example.description}
								</p>
							</div>

							<div className="p-4 sm:p-5">
								<div className="mb-3 flex items-center justify-between gap-3">
									<h3 className="text-sm font-semibold text-zinc-950">
										Short diff preview
									</h3>
									<span className="text-xs font-medium text-zinc-500">
										{countChangedLines(example.diff)}{" "}
										changed lines
									</span>
								</div>
								<pre className="max-h-[420px] overflow-auto rounded-md border border-zinc-300 bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
									<code>{example.diff}</code>
								</pre>
							</div>
						</div>

						<ReviewResult
							review={example.review}
							reviewMode={example.mode}
						/>
					</section>
				))}
			</section>
		</main>
	);
}

function countChangedLines(diff: string) {
	return diff
		.split("\n")
		.filter((line) => /^[+-](?![+-]{2})/.test(line.trimStart())).length;
}
