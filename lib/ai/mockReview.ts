import type {
  ReviewIssue,
  ReviewResponse,
  Severity,
} from "@/lib/schemas/review";
import type { ReviewProvider } from "./reviewProvider";

type Finding = ReviewIssue & { category: "bug" | "refactor" };

export class MockReviewProvider implements ReviewProvider {
  async reviewDiff(diff: string): Promise<ReviewResponse> {
    const normalized = diff.toLowerCase();
    const changedLines = countChangedLines(diff);
    const touchedFiles = countTouchedFiles(diff);
    const findings: Finding[] = [];
    const testSuggestions = new Set<string>();

    if (normalized.includes("useeffect")) {
      findings.push({
        category: "bug",
        title: "Verify useEffect dependency behavior",
        severity: "medium",
        description:
          "The diff updates React effect logic. Missing or unstable dependencies can cause stale state, repeated requests, or missed updates.",
        suggestedFix:
          "Review the dependency array, memoize callback inputs when needed, and add a regression test for the effect trigger conditions.",
      });
      testSuggestions.add(
        "Add a React component test that verifies the effect reacts to changed inputs without running unnecessarily.",
      );
    }

    if (normalized.includes("localstorage")) {
      findings.push({
        category: "bug",
        title: "Guard browser-only persistence",
        severity: "medium",
        description:
          "The change reads or writes localStorage. In a server-rendered app this must only run in the browser and should handle malformed stored values.",
        suggestedFix:
          "Wrap localStorage access in client-only code, check typeof window before access, and handle JSON parse failures gracefully.",
      });
      testSuggestions.add(
        "Cover the persistence path with tests for missing, valid, and malformed localStorage values.",
      );
    }

    if (/\bdangerouslysetinnerhtml\b/i.test(diff)) {
      findings.push({
        category: "bug",
        title: "Potential cross-site scripting risk",
        severity: "high",
        description:
          "The diff introduces dangerouslySetInnerHTML, which can expose users to script injection if the HTML is not sanitized upstream.",
        suggestedFix:
          "Avoid raw HTML when possible. If it is required, sanitize with a trusted library and document the trusted input boundary.",
      });
      testSuggestions.add(
        "Add a security-focused test or fixture that proves unsafe HTML is sanitized before rendering.",
      );
    }

    if (/\b(fetch|axios)\b/i.test(diff)) {
      findings.push({
        category: "bug",
        title: "Network request needs failure handling",
        severity: "medium",
        description:
          "The changed code performs an HTTP request. The diff should account for non-2xx responses, timeouts, and loading or retry states.",
        suggestedFix:
          "Check response status, catch request errors, expose user-friendly failure UI, and avoid leaving loading state active after failures.",
      });
      testSuggestions.add(
        "Mock failed and successful network responses to verify loading, success, and error states.",
      );
    }

    if (/\bany\b/.test(normalized)) {
      findings.push({
        category: "refactor",
        title: "Replace weak TypeScript types",
        severity: "medium",
        description:
          "The diff uses any, which weakens compile-time guarantees and can hide incorrect data assumptions in review-sensitive code.",
        suggestedFix:
          "Introduce explicit interfaces, discriminated unions, or Zod-inferred types for the values crossing this boundary.",
      });
      testSuggestions.add(
        "Add type-level or runtime schema coverage for the shape currently represented as any.",
      );
    }

    if (/\b(todo|console\.log)\b/i.test(diff)) {
      findings.push({
        category: "refactor",
        title: "Clean up debug or placeholder code",
        severity: "low",
        description:
          "The diff includes TODO markers or console logging that can create noisy production output or leave incomplete work ambiguous.",
        suggestedFix:
          "Remove console logging, convert TODOs into tracked issues, or replace placeholders with the intended implementation before merge.",
      });
    }

    if (changedLines > 120) {
      findings.push({
        category: "refactor",
        title: "Large diff increases review risk",
        severity: "medium",
        description:
          "This pull request changes many lines, which makes missed regressions more likely and increases the value of focused tests.",
        suggestedFix:
          "Consider splitting unrelated changes and call out the highest-risk files in the pull request description.",
      });
      testSuggestions.add(
        "Run focused regression tests around the files with the largest number of changed lines.",
      );
    }

    testSuggestions.add(
      "Add or update tests for the primary user-visible behavior changed by this diff.",
    );

    const possibleBugs = findings
      .filter((finding) => finding.category === "bug")
      .map(stripCategory);
    const refactoringSuggestions = findings
      .filter((finding) => finding.category === "refactor")
      .map(stripCategory);
    const overallRisk = determineRisk(findings, changedLines);

    return {
      summary: buildSummary({
        changedLines,
        touchedFiles,
        bugCount: possibleBugs.length,
        refactorCount: refactoringSuggestions.length,
        overallRisk,
      }),
      overallRisk,
      possibleBugs,
      refactoringSuggestions,
      testSuggestions: Array.from(testSuggestions),
      mergeRecommendation: determineRecommendation(overallRisk, findings),
      confidence: determineConfidence(diff, findings),
    };
  }
}

function stripCategory(finding: Finding): ReviewIssue {
  const { title, severity, description, suggestedFix } = finding;

  return { title, severity, description, suggestedFix };
}

function countChangedLines(diff: string) {
  return diff
    .split("\n")
    .filter((line) => /^[+-](?![+-]{2})/.test(line.trimStart())).length;
}

function countTouchedFiles(diff: string) {
  const files = diff
    .split("\n")
    .filter((line) => line.startsWith("diff --git")).length;

  return files || 1;
}

function determineRisk(findings: Finding[], changedLines: number): Severity {
  if (
    findings.some((finding) => finding.severity === "high") ||
    changedLines > 220
  ) {
    return "high";
  }

  if (
    findings.some((finding) => finding.severity === "medium") ||
    changedLines > 80
  ) {
    return "medium";
  }

  return "low";
}

function determineRecommendation(
  overallRisk: Severity,
  findings: Finding[],
): ReviewResponse["mergeRecommendation"] {
  if (
    overallRisk === "high" ||
    findings.some((finding) => finding.severity === "high")
  ) {
    return "reject";
  }

  if (
    overallRisk === "medium" ||
    findings.some((finding) => finding.severity === "medium")
  ) {
    return "needs_changes";
  }

  return "approve";
}

function determineConfidence(diff: string, findings: Finding[]) {
  const base = diff.includes("diff --git") ? 0.76 : 0.64;
  const boost = Math.min(findings.length * 0.03, 0.15);
  return Number(Math.min(base + boost, 0.91).toFixed(2));
}

function buildSummary({
  changedLines,
  touchedFiles,
  bugCount,
  refactorCount,
  overallRisk,
}: {
  changedLines: number;
  touchedFiles: number;
  bugCount: number;
  refactorCount: number;
  overallRisk: Severity;
}) {
  const issueText =
    bugCount + refactorCount === 0
      ? "no major heuristic findings"
      : `${bugCount} possible bug${bugCount === 1 ? "" : "s"} and ${refactorCount} refactoring suggestion${refactorCount === 1 ? "" : "s"}`;

  return `ReviewPilot inspected ${changedLines} changed line${changedLines === 1 ? "" : "s"} across ${touchedFiles} file${touchedFiles === 1 ? "" : "s"} and found ${issueText}. Overall risk is ${overallRisk}.`;
}
