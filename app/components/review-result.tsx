import {
	AlertTriangle,
	BadgeCheck,
	Bug,
	Code2,
	FileCode2,
	FlaskConical,
	Gauge,
	GitPullRequest,
	MapPin,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import type React from "react";
import type {
	ChangedFileSummary,
	ReviewIssue,
	ReviewMode,
	ReviewResponse,
} from "@/lib/schemas/review";

export const riskStyles = {
	low: "border-emerald-200 bg-emerald-50 text-emerald-700",
	medium: "border-amber-200 bg-amber-50 text-amber-800",
	high: "border-red-200 bg-red-50 text-red-700",
};

export const recommendationStyles = {
	approve: "border-emerald-200 bg-emerald-50 text-emerald-700",
	needs_changes: "border-amber-200 bg-amber-50 text-amber-800",
	reject: "border-red-200 bg-red-50 text-red-700",
};

export const recommendationLabels = {
	approve: "Approve",
	needs_changes: "Needs changes",
	reject: "Reject",
};

export const reviewModeLabels: Record<ReviewMode, string> = {
	general: "General",
	react: "React",
	typescript: "TypeScript",
	performance: "Frontend Performance",
};

type CategorizedIssue = ReviewIssue & {
	categoryLabel: "Possible bug" | "Refactor";
};

export function ReviewPanel({
	review,
	error,
	isLoading,
	reviewMode,
}: {
	review: ReviewResponse | null;
	error: string;
	isLoading: boolean;
	reviewMode: ReviewMode;
}) {
	if (isLoading) {
		return (
			<StateCard
				icon={
					<RefreshCw
						className="size-6 animate-spin"
						aria-hidden="true"
					/>
				}
				title="Analyzing diff"
				description="ReviewPilot AI is parsing changed files, checking added lines, and preparing a structured pull request review."
			/>
		);
	}

	if (error) {
		return (
			<StateCard
				icon={<AlertTriangle className="size-6" aria-hidden="true" />}
				title="Analysis failed"
				description={error}
			/>
		);
	}

	if (!review) {
		return (
			<StateCard
				icon={<Sparkles className="size-6" aria-hidden="true" />}
				title="Review output will appear here"
				description="Start with an example diff or paste your own pull request diff to generate a portfolio-ready structured code review."
			/>
		);
	}

	return <ReviewResult review={review} reviewMode={reviewMode} />;
}

export function ReviewResult({
	review,
	reviewMode,
}: {
	review: ReviewResponse;
	reviewMode: ReviewMode;
}) {
	const issues = getCategorizedIssues(review);

	return (
		<aside className="flex flex-col gap-4">
			<PullRequestSummary review={review} reviewMode={reviewMode} />
			<RiskScoreBreakdown review={review} />
			<ChangedFilesOverview files={review.changedFiles} />
			<IssuesByFile issues={issues} files={review.changedFiles} />
			<TestSuggestions suggestions={review.testSuggestions} />
		</aside>
	);
}

function PullRequestSummary({
	review,
	reviewMode,
}: {
	review: ReviewResponse;
	reviewMode: ReviewMode;
}) {
	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
						<GitPullRequest className="size-4" aria-hidden="true" />
						<span>Pull Request Summary</span>
					</div>
					<h2 className="mt-2 text-xl font-semibold text-zinc-950">
						{review.summary}
					</h2>
				</div>
				<div className="flex flex-wrap justify-end gap-2">
					<Badge className="border-zinc-200 bg-zinc-50 text-zinc-700">
						{reviewModeLabels[reviewMode]} mode
					</Badge>
					<Badge className={riskStyles[review.overallRisk]}>
						{review.overallRisk} risk
					</Badge>
				</div>
			</div>
			<div className="mt-5 grid gap-3 sm:grid-cols-2">
				<StatusTile
					label="Merge recommendation"
					value={recommendationLabels[review.mergeRecommendation]}
					className={recommendationStyles[review.mergeRecommendation]}
				/>
				<StatusTile
					label="Confidence"
					value={`${Math.round(review.confidence * 100)}%`}
					className="border-sky-200 bg-sky-50 text-sky-700"
				/>
			</div>
		</div>
	);
}

function RiskScoreBreakdown({ review }: { review: ReviewResponse }) {
	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<Gauge
							className="size-5 text-zinc-500"
							aria-hidden="true"
						/>
						<h3 className="font-semibold text-zinc-950">
							Risk Score Breakdown
						</h3>
					</div>
					<p className="mt-2 text-sm leading-6 text-zinc-600">
						The score explains which review signals contributed to
						the overall risk level.
					</p>
				</div>
				<div className="text-right">
					<div className="flex items-baseline justify-end gap-1">
						<span className="text-4xl font-semibold text-zinc-950">
							{review.riskScore}
						</span>
						<span className="text-sm font-semibold text-zinc-500">
							/100
						</span>
					</div>
					<Badge className={riskStyles[review.overallRisk]}>
						{review.overallRisk} risk
					</Badge>
				</div>
			</div>

			<div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-100">
				<div
					className={`h-full rounded-full ${getRiskBarColor(review.overallRisk)}`}
					style={{ width: `${review.riskScore}%` }}
				/>
			</div>

			{review.riskFactors.length === 0 ? (
				<p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
					No scoring factors were triggered by the current mock
					heuristics.
				</p>
			) : (
				<ul className="mt-5 space-y-3">
					{review.riskFactors.map((factor) => (
						<li
							key={`${factor.label}-${factor.impact}-${factor.reason}`}
							className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<h4 className="font-medium text-zinc-950">
											{factor.label}
										</h4>
										<Badge
											className={
												riskStyles[factor.severity]
											}
										>
											{factor.severity}
										</Badge>
									</div>
									<p className="mt-2 text-sm leading-6 text-zinc-600">
										{factor.reason}
									</p>
								</div>
								<span className="rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200">
									+{factor.impact}
								</span>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function ChangedFilesOverview({ files }: { files: ChangedFileSummary[] }) {
	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center gap-2">
				<FileCode2
					className="size-5 text-zinc-500"
					aria-hidden="true"
				/>
				<h3 className="font-semibold text-zinc-950">Changed Files</h3>
			</div>
			{files.length === 0 ? (
				<p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
					No changed files were parsed from this diff.
				</p>
			) : (
				<div className="grid gap-3">
					{files.map((file) => (
						<FileCard key={file.filePath} file={file} />
					))}
				</div>
			)}
		</div>
	);
}

function FileCard({ file }: { file: ChangedFileSummary }) {
	return (
		<article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h4 className="break-words font-mono text-sm font-semibold text-zinc-950">
						{file.filePath}
					</h4>
					<p className="mt-1 text-xs font-medium text-zinc-500">
						{file.language}
					</p>
				</div>
				<Badge className={riskStyles[file.riskLevel]}>
					{file.riskLevel} risk
				</Badge>
			</div>
			<div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
				<span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200">
					+{file.additions}
				</span>
				<span className="rounded-md bg-red-50 px-2 py-1 text-red-700 ring-1 ring-red-200">
					-{file.deletions}
				</span>
			</div>
		</article>
	);
}

function IssuesByFile({
	issues,
	files,
}: {
	issues: CategorizedIssue[];
	files: ChangedFileSummary[];
}) {
	const filePaths = [
		...files.map((file) => file.filePath),
		...issues
			.map((issue) => issue.location?.filePath)
			.filter((filePath): filePath is string => Boolean(filePath)),
	].filter((filePath, index, all) => all.indexOf(filePath) === index);

	const unlocatedIssues = issues.filter((issue) => !issue.location?.filePath);

	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center gap-2">
				<Bug className="size-5 text-zinc-500" aria-hidden="true" />
				<h3 className="font-semibold text-zinc-950">Issues by File</h3>
			</div>
			{issues.length === 0 ? (
				<p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
					No location-aware issues detected by the mock heuristics.
				</p>
			) : (
				<div className="space-y-4">
					{filePaths.map((filePath) => {
						const fileIssues = issues.filter(
							(issue) => issue.location?.filePath === filePath,
						);
						if (fileIssues.length === 0) return null;

						return (
							<section key={filePath}>
								<h4 className="mb-2 break-words font-mono text-sm font-semibold text-zinc-950">
									{filePath}
								</h4>
								<div className="space-y-3">
									{fileIssues.map((issue) => (
										<IssueCard
											key={getIssueKey(issue)}
											issue={issue}
										/>
									))}
								</div>
							</section>
						);
					})}

					{unlocatedIssues.length > 0 ? (
						<section>
							<h4 className="mb-2 text-sm font-semibold text-zinc-950">
								Pull request level
							</h4>
							<div className="space-y-3">
								{unlocatedIssues.map((issue) => (
									<IssueCard
										key={getIssueKey(issue)}
										issue={issue}
									/>
								))}
							</div>
						</section>
					) : null}
				</div>
			)}
		</div>
	);
}

function IssueCard({ issue }: { issue: CategorizedIssue }) {
	return (
		<article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h5 className="font-medium text-zinc-950">
							{issue.title}
						</h5>
						<span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-600">
							{issue.categoryLabel}
						</span>
					</div>
					{issue.location ? (
						<div className="mt-2 flex items-start gap-1.5 text-xs font-medium text-zinc-500">
							<MapPin
								className="mt-0.5 size-3.5 shrink-0"
								aria-hidden="true"
							/>
							<span className="break-words">
								{issue.location.filePath}
								{issue.location.lineNumber
									? `:${issue.location.lineNumber}`
									: ""}
							</span>
						</div>
					) : null}
				</div>
				<Badge className={riskStyles[issue.severity]}>
					{issue.severity}
				</Badge>
			</div>

			{issue.location?.codeSnippet ? (
				<pre className="mt-3 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
					<code>{issue.location.codeSnippet}</code>
				</pre>
			) : null}

			<p className="mt-3 text-sm leading-6 text-zinc-700">
				{issue.description}
			</p>
			<div className="mt-3 flex gap-2 rounded-md bg-white p-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
				<Code2
					className="mt-0.5 size-4 shrink-0 text-zinc-500"
					aria-hidden="true"
				/>
				<span>{issue.suggestedFix}</span>
			</div>
		</article>
	);
}

function TestSuggestions({ suggestions }: { suggestions: string[] }) {
	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center gap-2">
				<FlaskConical
					className="size-5 text-zinc-500"
					aria-hidden="true"
				/>
				<h3 className="font-semibold text-zinc-950">
					Test suggestions
				</h3>
			</div>
			<ul className="space-y-3">
				{suggestions.map((suggestion) => (
					<li
						key={suggestion}
						className="flex gap-3 text-sm text-zinc-700"
					>
						<BadgeCheck
							className="mt-0.5 size-4 shrink-0 text-emerald-600"
							aria-hidden="true"
						/>
						<span>{suggestion}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function getCategorizedIssues(review: ReviewResponse): CategorizedIssue[] {
	return [
		...review.possibleBugs.map((issue) => ({
			...issue,
			categoryLabel: "Possible bug" as const,
		})),
		...review.refactoringSuggestions.map((issue) => ({
			...issue,
			categoryLabel: "Refactor" as const,
		})),
	];
}

function getIssueKey(issue: CategorizedIssue) {
	return `${issue.categoryLabel}-${issue.title}-${issue.location?.filePath ?? "pr"}-${issue.location?.lineNumber ?? "na"}`;
}

function getRiskBarColor(risk: ReviewResponse["overallRisk"]) {
	if (risk === "high") return "bg-red-500";
	if (risk === "medium") return "bg-amber-500";
	return "bg-emerald-500";
}

function StatusTile({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className: string;
}) {
	return (
		<div className={`rounded-md border px-4 py-3 ${className}`}>
			<p className="text-xs font-medium uppercase tracking-normal opacity-80">
				{label}
			</p>
			<p className="mt-1 text-lg font-semibold">{value}</p>
		</div>
	);
}

function Badge({
	children,
	className,
}: {
	children: React.ReactNode;
	className: string;
}) {
	return (
		<span
			className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${className}`}
		>
			{children}
		</span>
	);
}

function StateCard({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<aside className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
			<div className="max-w-sm">
				<div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-zinc-950 text-white">
					{icon}
				</div>
				<h2 className="mt-5 text-xl font-semibold text-zinc-950">
					{title}
				</h2>
				<p className="mt-3 text-sm leading-6 text-zinc-600">
					{description}
				</p>
			</div>
		</aside>
	);
}
