import type {
  ReviewMode,
  ReviewIssue,
  ReviewResponse,
  Severity,
} from "@/lib/schemas/review";
import type { ReviewProvider } from "./reviewProvider";

type Finding = ReviewIssue & { category: "bug" | "refactor" };

const modeLabels: Record<ReviewMode, string> = {
  general: "General",
  react: "React",
  typescript: "TypeScript",
  performance: "Frontend Performance",
};

export class MockReviewProvider implements ReviewProvider {
  async reviewDiff(diff: string, mode: ReviewMode): Promise<ReviewResponse> {
    const normalized = diff.toLowerCase();
    const changedLines = countChangedLines(diff);
    const touchedFiles = countTouchedFiles(diff);
    const addedLines = getAddedLines(diff);
    const findings: Finding[] = [];
    const testSuggestions = new Set<string>();

    applyBaseHeuristics({
      diff,
      normalized,
      changedLines,
      findings,
      testSuggestions,
    });
    applyModeHeuristics({
      mode,
      diff,
      normalized,
      addedLines,
      findings,
      testSuggestions,
    });

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
        mode,
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
      confidence: determineConfidence(diff, findings, mode),
    };
  }
}

function applyBaseHeuristics({
  diff,
  normalized,
  changedLines,
  findings,
  testSuggestions,
}: {
  diff: string;
  normalized: string;
  changedLines: number;
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
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
}

function applyModeHeuristics({
  mode,
  diff,
  normalized,
  addedLines,
  findings,
  testSuggestions,
}: {
  mode: ReviewMode;
  diff: string;
  normalized: string;
  addedLines: string[];
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
  if (mode === "general") {
    applyGeneralHeuristics({ normalized, findings, testSuggestions });
    return;
  }

  if (mode === "react") {
    applyReactHeuristics({
      diff,
      normalized,
      addedLines,
      findings,
      testSuggestions,
    });
    return;
  }

  if (mode === "typescript") {
    applyTypeScriptHeuristics({ diff, normalized, findings, testSuggestions });
    return;
  }

  if (mode === "performance") {
    applyPerformanceHeuristics({
      diff,
      normalized,
      addedLines,
      findings,
      testSuggestions,
    });
  }
}

function applyGeneralHeuristics({
  normalized,
  findings,
  testSuggestions,
}: {
  normalized: string;
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
  if (normalized.includes("useeffect")) {
    findings.push({
      category: "bug",
      title: "Review React effect dependencies",
      severity: "medium",
      description:
        "General mode found React effect changes. Effects are a common source of stale state, repeated requests, or missed updates when dependencies are incomplete.",
      suggestedFix:
        "Check the dependency array and add a focused component test for the conditions that should trigger the effect.",
    });
    testSuggestions.add(
      "Add a React component test that verifies the effect reacts to changed inputs without running unnecessarily.",
    );
  }

  if (/\bany\b/.test(normalized)) {
    findings.push({
      category: "refactor",
      title: "Strengthen loose TypeScript types",
      severity: "medium",
      description:
        "General mode found any, which can hide incorrect assumptions and reduce confidence in the reviewed change.",
      suggestedFix:
        "Replace any with explicit types, unknown plus narrowing, or schema-derived types at the boundary.",
    });
    testSuggestions.add(
      "Add type-level or runtime schema coverage for the shape currently represented as any.",
    );
  }
}

function applyReactHeuristics({
  diff,
  normalized,
  addedLines,
  findings,
  testSuggestions,
}: {
  diff: string;
  normalized: string;
  addedLines: string[];
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
  if (normalized.includes("useeffect")) {
    findings.push({
      category: "bug",
      title: "Verify useEffect dependency behavior",
      severity: "medium",
      description:
        "React mode detected effect logic. Missing, stale, or unstable dependencies can cause repeated requests, stale state, or missed updates.",
      suggestedFix:
        "Review the dependency array, memoize callback inputs only when needed, and add a regression test for the effect trigger conditions.",
    });
    testSuggestions.add(
      "Add a React component test that verifies the effect reacts to changed inputs without running unnecessarily.",
    );
  }

  if (/\b(usememo|usecallback)\b/i.test(diff)) {
    findings.push({
      category: "refactor",
      title: "Validate memoization value and dependencies",
      severity: "medium",
      description:
        "React mode found useMemo or useCallback. Memoization can hide dependency bugs or add complexity when the cached value is cheap.",
      suggestedFix:
        "Keep memoization only for measured expensive work or stable referential contracts, and verify every captured value is listed as a dependency.",
    });
    testSuggestions.add(
      "Cover memoized behavior with tests that change each dependency and assert the rendered output updates correctly.",
    );
  }

  if (/\.\s*map\s*\(/.test(diff) && !/\bkey\s*=/.test(diff)) {
    findings.push({
      category: "bug",
      title: "Mapped JSX may be missing stable keys",
      severity: "medium",
      description:
        "React mode detected array rendering without an obvious key prop in the diff. Missing keys can cause incorrect DOM reuse and state leakage between rows.",
      suggestedFix:
        "Add a stable key based on item identity instead of array index whenever the list can reorder, insert, or delete items.",
    });
    testSuggestions.add(
      "Add a rendering test for list updates so reordered or removed rows keep the correct content and state.",
    );
  }

  if (hasPropDrillingSigns(addedLines)) {
    findings.push({
      category: "refactor",
      title: "Possible prop drilling introduced",
      severity: "low",
      description:
        "React mode found a component receiving many added props. This can make intermediate components harder to maintain when they only forward data downward.",
      suggestedFix:
        "Group related props into a typed object, colocate state closer to consumers, or introduce context only when several branches need the same data.",
    });
  }
}

function applyTypeScriptHeuristics({
  diff,
  normalized,
  findings,
  testSuggestions,
}: {
  diff: string;
  normalized: string;
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
  if (/\bany\b/.test(normalized)) {
    findings.push({
      category: "refactor",
      title: "Replace weak TypeScript types",
      severity: "medium",
      description:
        "TypeScript mode found any, which weakens compile-time guarantees and can hide incorrect data assumptions in review-sensitive code.",
      suggestedFix:
        "Introduce explicit interfaces, discriminated unions, unknown with narrowing, or Zod-inferred types for values crossing this boundary.",
    });
    testSuggestions.add(
      "Add type-level or runtime schema coverage for the shape currently represented as any.",
    );
  }

  if (/\bas\s+[A-Za-z_{]/.test(diff)) {
    findings.push({
      category: "refactor",
      title: "Type assertion may bypass safe narrowing",
      severity: "medium",
      description:
        "TypeScript mode detected an as assertion. Assertions can silence mismatches between runtime data and the declared type.",
      suggestedFix:
        "Prefer control-flow narrowing, schema parsing, type guards, or the satisfies operator when the value shape can be checked safely.",
    });
  }

  if (/@ts-ignore/.test(diff)) {
    findings.push({
      category: "bug",
      title: "ts-ignore suppresses compiler feedback",
      severity: "high",
      description:
        "TypeScript mode found @ts-ignore. Suppressing the compiler can hide real type errors and make future refactors less safe.",
      suggestedFix:
        "Remove the suppression by fixing the type mismatch, or use @ts-expect-error with a narrow explanation when the exception is intentional.",
    });
    testSuggestions.add(
      "Add coverage around the suppressed branch before replacing the directive with a safer type model.",
    );
  }

  if (
    /\b(fetch|axios)\b/i.test(diff) &&
    !/(:\s*Promise<|interface\s+\w*Response|type\s+\w*Response|z\.)/i.test(diff)
  ) {
    findings.push({
      category: "refactor",
      title: "API response shape is not explicit",
      severity: "medium",
      description:
        "TypeScript mode found a network call without an obvious response type or runtime schema. The payload may be used with assumptions the compiler cannot verify.",
      suggestedFix:
        "Define a response type, parse unknown JSON through a schema, and keep the typed boundary close to the request helper.",
    });
  }
}

function applyPerformanceHeuristics({
  diff,
  normalized,
  addedLines,
  findings,
  testSuggestions,
}: {
  diff: string;
  normalized: string;
  addedLines: string[];
  findings: Finding[];
  testSuggestions: Set<string>;
}) {
  if (addedLines.some((line) => /\w+=\{(\{|\(\)\s*=>|function\b)/.test(line))) {
    findings.push({
      category: "refactor",
      title: "Inline props may trigger avoidable renders",
      severity: "medium",
      description:
        "Frontend Performance mode found inline object or function props. These create new references on every render and can defeat memoized children.",
      suggestedFix:
        "Move stable objects outside the component, memoize callbacks when children rely on reference equality, or pass primitive props where practical.",
    });
  }

  if (addedLines.some((line) => /\.(filter|sort|reduce)\s*\(/.test(line))) {
    findings.push({
      category: "refactor",
      title: "Expensive array work may run during render",
      severity: "medium",
      description:
        "Frontend Performance mode detected filtering, sorting, or reducing in changed lines. Re-running expensive work on every render can slow large datasets.",
      suggestedFix:
        "Precompute on the server, memoize based on stable dependencies, or move the work into a selector with clear invalidation rules.",
    });
    testSuggestions.add(
      "Add a regression test or profiling note for large input sizes around the transformed collection.",
    );
  }

  if (
    /\.\s*map\s*\(/.test(diff) &&
    (countChangedLines(diff) > 80 || /items|rows|results|list/i.test(diff))
  ) {
    findings.push({
      category: "refactor",
      title: "Large mapped lists may need virtualization",
      severity: "medium",
      description:
        "Frontend Performance mode found list rendering that may grow with user data. Rendering every row can hurt interaction latency for large collections.",
      suggestedFix:
        "Use pagination, windowing, or virtualization for large lists, and keep row components lightweight.",
    });
  }

  if (
    normalized.includes("usestate") &&
    (normalized.includes("useeffect") ||
      /\bderived|selected|filtered|sorted\b/i.test(diff))
  ) {
    findings.push({
      category: "refactor",
      title: "Derived state may be unnecessary",
      severity: "low",
      description:
        "Frontend Performance mode found state patterns that may duplicate values derivable from props or existing state. Duplicated derived state can cause extra renders and stale UI.",
      suggestedFix:
        "Compute derived values during render or with useMemo when the calculation is expensive and dependencies are clear.",
    });
  }
}

function getAddedLines(diff: string) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim());
}

function hasPropDrillingSigns(addedLines: string[]) {
  const componentSignature = addedLines.find((line) =>
    /(function|const)\s+[A-Z]\w*|=>\s*\(/.test(line),
  );

  if (!componentSignature) return false;

  const propMatches = componentSignature.match(/\b\w+\??:/g) ?? [];
  const destructuredProps = componentSignature.match(/\{([^}]+)\}/)?.[1] ?? "";
  const propCount = Math.max(
    propMatches.length,
    destructuredProps.split(",").filter(Boolean).length,
  );

  return propCount >= 5;
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

function determineConfidence(
  diff: string,
  findings: Finding[],
  mode: ReviewMode,
) {
  const base = diff.includes("diff --git") ? 0.76 : 0.64;
  const modeBoost = mode === "general" ? 0 : 0.04;
  const findingBoost = Math.min(findings.length * 0.03, 0.15);
  return Number(Math.min(base + modeBoost + findingBoost, 0.93).toFixed(2));
}

function buildSummary({
  mode,
  changedLines,
  touchedFiles,
  bugCount,
  refactorCount,
  overallRisk,
}: {
  mode: ReviewMode;
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

  return `ReviewPilot inspected ${changedLines} changed line${changedLines === 1 ? "" : "s"} across ${touchedFiles} file${touchedFiles === 1 ? "" : "s"} in ${modeLabels[mode]} mode and found ${issueText}. Overall risk is ${overallRisk}.`;
}
