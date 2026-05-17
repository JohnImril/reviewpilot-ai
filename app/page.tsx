"use client";

import { ClipboardList, Eraser, Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { AppNav } from "@/app/components/app-nav";
import { ReviewPanel, reviewModeLabels } from "@/app/components/review-result";
import { exampleDiffs } from "@/data/exampleDiffs";
import {
	type ReviewMode,
	reviewResponseSchema,
	type ReviewResponse,
} from "@/lib/schemas/review";

const reviewModes: Array<{
	value: ReviewMode;
	label: string;
	description: string;
}> = [
	{
		value: "general",
		label: "General",
		description: "Balanced review",
	},
	{
		value: "react",
		label: "React",
		description: "Hooks and rendering",
	},
	{
		value: "typescript",
		label: "TypeScript",
		description: "Types and contracts",
	},
	{
		value: "performance",
		label: "Frontend Performance",
		description: "Render cost",
	},
];

export default function Home() {
	const [diff, setDiff] = useState("");
	const [reviewMode, setReviewMode] = useState<ReviewMode>("general");
	const [review, setReview] = useState<ReviewResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [exampleIndex, setExampleIndex] = useState(0);

	const diffStats = useMemo(() => {
		const lines = diff.split("\n");
		return {
			changed: lines.filter((line) => /^[+-](?![+-]{2})/.test(line))
				.length,
			files: lines.filter((line) => line.startsWith("diff --git")).length,
			characters: diff.length,
		};
	}, [diff]);

	async function analyzeDiff() {
		if (!diff.trim()) {
			setError("Paste a git diff or load an example before analyzing.");
			setReview(null);
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			const response = await fetch("/api/review", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ diff, mode: reviewMode }),
			});

			const payload: unknown = await response.json();

			if (!response.ok) {
				const message =
					typeof payload === "object" &&
					payload !== null &&
					"error" in payload &&
					typeof payload.error === "string"
						? payload.error
						: "The review service returned an error.";
				throw new Error(message);
			}

			setReview(reviewResponseSchema.parse(payload));
		} catch (caughtError) {
			setReview(null);
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Unable to analyze this diff.",
			);
		} finally {
			setIsLoading(false);
		}
	}

	function loadExampleDiff() {
		const nextExample = exampleDiffs[exampleIndex % exampleDiffs.length];
		setDiff(nextExample.diff.trim());
		setReviewMode(nextExample.mode);
		setReview(null);
		setError("");
		setExampleIndex((current) => current + 1);
	}

	function clearWorkspace() {
		setDiff("");
		setReview(null);
		setError("");
	}

	return (
		<main className="min-h-screen bg-[#f6f5f2] text-zinc-950">
			<section className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
					<AppNav current="home" />

					<div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
						<div className="max-w-3xl">
							<p className="text-base leading-7 text-zinc-600 sm:text-lg">
								Paste a git diff and get a structured review
								with likely bugs, refactoring opportunities,
								test coverage gaps, risk level, and a merge
								recommendation. Choose a review mode to focus
								the local heuristics. The MVP runs fully without
								API keys.
							</p>
						</div>
						<div className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
							<Metric
								label="Changed lines"
								value={diffStats.changed}
							/>
							<Metric label="Files" value={diffStats.files} />
							<Metric
								label="Chars"
								value={diffStats.characters}
							/>
						</div>
					</div>
				</div>
			</section>

			<section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:px-10">
				<div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
						<div>
							<h2 className="text-base font-semibold text-zinc-950">
								Diff input
							</h2>
							<p className="text-sm text-zinc-500">
								Supports unified git diffs from GitHub, GitLab,
								or local git.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={loadExampleDiff}
								className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
							>
								<ClipboardList
									className="size-4"
									aria-hidden="true"
								/>
								Load Example Diff
							</button>
							<button
								type="button"
								onClick={clearWorkspace}
								className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
							>
								<Eraser className="size-4" aria-hidden="true" />
								Clear
							</button>
						</div>
					</div>

					<div className="p-4 sm:p-5">
						<ReviewModeSelector
							selectedMode={reviewMode}
							onSelect={(mode) => {
								setReviewMode(mode);
								setReview(null);
								setError("");
							}}
						/>
						<textarea
							value={diff}
							onChange={(event) => {
								setDiff(event.target.value);
								if (error) setError("");
							}}
							spellCheck={false}
							placeholder="Paste a git diff here..."
							className="mt-4 min-h-[480px] w-full resize-y rounded-md border border-zinc-300 bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-4 focus:ring-zinc-200"
						/>
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
							<p className="text-sm text-zinc-500">
								Analysis is deterministic and powered by local
								heuristics.
							</p>
							<button
								type="button"
								onClick={analyzeDiff}
								disabled={isLoading}
								className="inline-flex h-11 items-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
							>
								{isLoading ? (
									<Loader2
										className="size-4 animate-spin"
										aria-hidden="true"
									/>
								) : (
									<Play
										className="size-4"
										aria-hidden="true"
									/>
								)}
								Analyze Diff
							</button>
						</div>
					</div>
				</div>

				<ReviewPanel
					review={review}
					error={error}
					isLoading={isLoading}
					reviewMode={reviewMode}
				/>
			</section>
		</main>
	);
}

function ReviewModeSelector({
	selectedMode,
	onSelect,
}: {
	selectedMode: ReviewMode;
	onSelect: (mode: ReviewMode) => void;
}) {
	return (
		<div>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-zinc-950">
					Review mode
				</h3>
				<span className="text-xs font-medium text-zinc-500">
					{reviewModeLabels[selectedMode]}
				</span>
			</div>
			<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
				{reviewModes.map((mode) => {
					const isSelected = selectedMode === mode.value;

					return (
						<button
							key={mode.value}
							type="button"
							onClick={() => onSelect(mode.value)}
							className={`rounded-md border px-3 py-3 text-left transition ${
								isSelected
									? "border-zinc-950 bg-zinc-950 text-white"
									: "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white"
							}`}
						>
							<span className="block text-sm font-semibold">
								{mode.label}
							</span>
							<span
								className={`mt-1 block text-xs ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}
							>
								{mode.description}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-md bg-white px-3 py-3 text-center shadow-sm ring-1 ring-zinc-200">
			<p className="text-xl font-semibold text-zinc-950">{value}</p>
			<p className="mt-1 text-xs font-medium uppercase tracking-normal text-zinc-500">
				{label}
			</p>
		</div>
	);
}
