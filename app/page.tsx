"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Bug,
  ClipboardList,
  Code2,
  Eraser,
  FlaskConical,
  GitPullRequestArrow,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { exampleDiffs } from "@/data/exampleDiffs";
import {
  reviewResponseSchema,
  type ReviewIssue,
  type ReviewResponse,
} from "@/lib/schemas/review";

const riskStyles = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-700",
};

const recommendationStyles = {
  approve: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_changes: "border-amber-200 bg-amber-50 text-amber-800",
  reject: "border-red-200 bg-red-50 text-red-700",
};

const recommendationLabels = {
  approve: "Approve",
  needs_changes: "Needs changes",
  reject: "Reject",
};

export default function Home() {
  const [diff, setDiff] = useState("");
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);

  const diffStats = useMemo(() => {
    const lines = diff.split("\n");
    return {
      changed: lines.filter((line) => /^[+-](?![+-]{2})/.test(line)).length,
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
        body: JSON.stringify({ diff }),
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
          <nav className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <GitPullRequestArrow className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  ReviewPilot AI
                </p>
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
                  Pull request review assistant
                </h1>
              </div>
            </div>
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600">
              Mock AI provider active
            </div>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-base leading-7 text-zinc-600 sm:text-lg">
                Paste a git diff and get a structured review with likely bugs,
                refactoring opportunities, test coverage gaps, risk level, and a
                merge recommendation. The MVP runs fully without API keys.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <Metric label="Changed lines" value={diffStats.changed} />
              <Metric label="Files" value={diffStats.files} />
              <Metric label="Chars" value={diffStats.characters} />
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
                Supports unified git diffs from GitHub, GitLab, or local git.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadExampleDiff}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <ClipboardList className="size-4" aria-hidden="true" />
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
            <textarea
              value={diff}
              onChange={(event) => {
                setDiff(event.target.value);
                if (error) setError("");
              }}
              spellCheck={false}
              placeholder="Paste a git diff here..."
              className="min-h-[520px] w-full resize-y rounded-md border border-zinc-300 bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-4 focus:ring-zinc-200"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">
                Analysis is deterministic and powered by local heuristics.
              </p>
              <button
                type="button"
                onClick={analyzeDiff}
                disabled={isLoading}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                Analyze Diff
              </button>
            </div>
          </div>
        </div>

        <ReviewPanel review={review} error={error} isLoading={isLoading} />
      </section>
    </main>
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

function ReviewPanel({
  review,
  error,
  isLoading,
}: {
  review: ReviewResponse | null;
  error: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <StateCard
        icon={<RefreshCw className="size-6 animate-spin" aria-hidden="true" />}
        title="Analyzing diff"
        description="ReviewPilot AI is checking the changed lines against risk heuristics and preparing a structured review."
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

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Review summary</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              {review.summary}
            </h2>
          </div>
          <Badge className={riskStyles[review.overallRisk]}>
            {review.overallRisk} risk
          </Badge>
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

      <IssueSection
        title="Possible bugs"
        icon={<Bug className="size-5" aria-hidden="true" />}
        issues={review.possibleBugs}
        emptyText="No likely bugs detected by the mock heuristics."
      />
      <IssueSection
        title="Refactoring suggestions"
        icon={<ShieldAlert className="size-5" aria-hidden="true" />}
        issues={review.refactoringSuggestions}
        emptyText="No refactoring suggestions detected by the mock heuristics."
      />
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FlaskConical className="size-5 text-zinc-500" aria-hidden="true" />
          <h3 className="font-semibold text-zinc-950">Test suggestions</h3>
        </div>
        <ul className="space-y-3">
          {review.testSuggestions.map((suggestion) => (
            <li key={suggestion} className="flex gap-3 text-sm text-zinc-700">
              <BadgeCheck
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function IssueSection({
  title,
  icon,
  issues,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  issues: ReviewIssue[];
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-zinc-500">{icon}</span>
        <h3 className="font-semibold text-zinc-950">{title}</h3>
      </div>
      {issues.length === 0 ? (
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <article
              key={`${issue.title}-${issue.description}`}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-zinc-950">{issue.title}</h4>
                <Badge className={riskStyles[issue.severity]}>
                  {issue.severity}
                </Badge>
              </div>
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
          ))}
        </div>
      )}
    </div>
  );
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
        <h2 className="mt-5 text-xl font-semibold text-zinc-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
      </div>
    </aside>
  );
}
