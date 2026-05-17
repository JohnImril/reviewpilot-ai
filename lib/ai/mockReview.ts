import type {
	ChangedFileSummary,
	ReviewIssue,
	ReviewMode,
	ReviewResponse,
	RiskFactor,
	Severity,
} from "@/lib/schemas/review";
import {
	type ParsedDiffFile,
	type ParsedDiffLine,
	parseDiff,
} from "@/lib/diff/parseDiff";
import type { ReviewProvider } from "./reviewProvider";

type Finding = ReviewIssue & { category: "bug" | "refactor" };

const modeLabels: Record<ReviewMode, string> = {
	general: "General",
	react: "React",
	typescript: "TypeScript",
	performance: "Frontend Performance",
};

export class MockAIProvider implements ReviewProvider {
	async reviewDiff(diff: string, mode: ReviewMode): Promise<ReviewResponse> {
		const parsedDiff = parseDiff(diff);
		const findings: Finding[] = [];
		const testSuggestions = new Set<string>();

		for (const file of parsedDiff.files) {
			applyFileHeuristics({ file, findings, testSuggestions });
			applyLineHeuristics({ file, mode, findings, testSuggestions });
		}

		testSuggestions.add(
			"Add or update tests for the primary user-visible behavior changed by this diff.",
		);

		const changedFiles = buildChangedFiles(parsedDiff.files, findings);
		const possibleBugs = findings
			.filter((finding) => finding.category === "bug")
			.map(stripCategory);
		const refactoringSuggestions = findings
			.filter((finding) => finding.category === "refactor")
			.map(stripCategory);
		const riskFactors = buildRiskFactors(parsedDiff.files, findings);
		const riskScore = calculateRiskScore(riskFactors);
		const overallRisk = determineRiskFromScore(riskScore);

		return {
			summary: buildSummary({
				mode,
				changedFiles,
				bugCount: possibleBugs.length,
				refactorCount: refactoringSuggestions.length,
				overallRisk,
				riskScore,
			}),
			overallRisk,
			riskScore,
			riskFactors,
			changedFiles,
			possibleBugs,
			refactoringSuggestions,
			testSuggestions: Array.from(testSuggestions),
			mergeRecommendation: determineRecommendation(overallRisk, findings),
			confidence: determineConfidence(diff, findings, mode, changedFiles),
		};
	}
}

function applyFileHeuristics({
	file,
	findings,
	testSuggestions,
}: {
	file: ParsedDiffFile;
	findings: Finding[];
	testSuggestions: Set<string>;
}) {
	if (isPackageFile(file.newPath) && file.additions + file.deletions > 0) {
		findings.push({
			category: "refactor",
			title: "Review dependency or script changes",
			severity: "medium",
			location: {
				filePath: file.newPath,
				codeSnippet: "package.json changed",
			},
			description:
				"This pull request changes package metadata. Dependency, script, or engine changes can affect build behavior and deployment reproducibility.",
			suggestedFix:
				"Verify lockfile changes, package provenance, version ranges, and CI build output before merging.",
		});
		testSuggestions.add(
			"Run install, lint, and production build checks after dependency changes.",
		);
	}

	if (isSensitivePath(file.newPath)) {
		testSuggestions.add(
			`Add focused regression coverage for sensitive changes in ${file.newPath}.`,
		);
	}

	if (file.additions > 80) {
		findings.push({
			category: "refactor",
			title: "Large file change increases review risk",
			severity: "medium",
			location: {
				filePath: file.newPath,
			},
			description:
				"This file has a large number of added lines, which raises the chance that behavior changes are hard to review in one pass.",
			suggestedFix:
				"Split unrelated changes or summarize the key behavior changes in the pull request description.",
		});
	}
}

function applyLineHeuristics({
	file,
	mode,
	findings,
	testSuggestions,
}: {
	file: ParsedDiffFile;
	mode: ReviewMode;
	findings: Finding[];
	testSuggestions: Set<string>;
}) {
	for (const hunk of file.hunks) {
		hunk.lines.forEach((line, lineIndex) => {
			if (line.type !== "add") return;

			const content = line.content;
			const normalized = content.toLowerCase();
			const location = buildLocation(file, line);

			if (/\buseeffect\b/.test(normalized)) {
				findings.push({
					category: "bug",
					title: "Verify useEffect dependencies",
					severity: mode === "react" ? "medium" : "low",
					location,
					description:
						"This added effect should be checked for stale closures, incomplete dependencies, and repeated side effects.",
					suggestedFix:
						"Confirm every value read inside the effect is represented in the dependency array or intentionally stable.",
				});
				testSuggestions.add(
					"Add a React component test that verifies effects respond to changed inputs without unnecessary reruns.",
				);
			}

			if (/\bany\b/.test(normalized)) {
				findings.push({
					category: "refactor",
					title: "Replace weak TypeScript typing",
					severity: mode === "typescript" ? "medium" : "low",
					location,
					description:
						"The added line uses any, which weakens compile-time feedback and can hide incorrect assumptions about runtime data.",
					suggestedFix:
						"Replace any with an explicit type, unknown plus narrowing, a type guard, or a Zod-inferred boundary type.",
				});
				testSuggestions.add(
					"Add type-level or runtime schema coverage for values currently represented as any.",
				);
			}

			if (
				/\b(fetch|axios)\b/.test(normalized) &&
				!hasNearbyErrorHandling(hunk.lines, lineIndex)
			) {
				findings.push({
					category: "bug",
					title: "Network request needs failure handling",
					severity: "medium",
					location,
					description:
						"This request is added without nearby error handling. Non-2xx responses, rejected promises, or malformed payloads could leave the UI in an incorrect state.",
					suggestedFix:
						"Add try/catch, check response status, and expose loading and failure states close to the request flow.",
				});
				testSuggestions.add(
					"Mock successful and failed network responses to verify loading, success, and error states.",
				);
			}

			if (/\bdangerouslysetinnerhtml\b/.test(normalized)) {
				findings.push({
					category: "bug",
					title: "Potential cross-site scripting risk",
					severity: "high",
					location,
					description:
						"The added rendering path uses dangerouslySetInnerHTML. Unsanitized HTML can expose users to script injection.",
					suggestedFix:
						"Avoid raw HTML when possible. If HTML is required, sanitize it at a trusted boundary and document the input source.",
				});
				testSuggestions.add(
					"Add a security-focused test proving unsafe HTML is sanitized before rendering.",
				);
			}

			if (/\bconsole\.log\b|\btodo\b/i.test(content)) {
				findings.push({
					category: "refactor",
					title: "Clean up debug or placeholder code",
					severity: "low",
					location,
					description:
						"Debug logging and TODO markers can create noisy production output or leave incomplete work ambiguous.",
					suggestedFix:
						"Remove console logging and convert TODOs into tracked work before merge.",
				});
			}

			if (
				mode === "performance" &&
				/\w+=\{(\{|\(\)\s*=>|function\b)/.test(content)
			) {
				findings.push({
					category: "refactor",
					title: "Inline props may trigger avoidable renders",
					severity: "medium",
					location,
					description:
						"This added prop creates a new object or function reference during render and can defeat memoized child components.",
					suggestedFix:
						"Move stable objects outside the component, pass primitives, or memoize callbacks when reference equality matters.",
				});
			}

			if (
				mode === "performance" &&
				/\.(filter|sort|reduce)\s*\(/.test(content)
			) {
				findings.push({
					category: "refactor",
					title: "Expensive array work may run during render",
					severity: "medium",
					location,
					description:
						"Filtering, sorting, or reducing inside render can become expensive for large datasets and repeated renders.",
					suggestedFix:
						"Memoize the derived collection with clear dependencies or move the work to a selector/server boundary.",
				});
				testSuggestions.add(
					"Add a regression test or profiling note for large input sizes around the transformed collection.",
				);
			}
		});
	}
}

function buildChangedFiles(
	files: ParsedDiffFile[],
	findings: Finding[],
): ChangedFileSummary[] {
	return files.map((file) => ({
		filePath: file.newPath,
		language: file.language,
		additions: file.additions,
		deletions: file.deletions,
		riskLevel: determineFileRisk(file, findings),
	}));
}

function determineFileRisk(
	file: ParsedDiffFile,
	findings: Finding[],
): Severity {
	const fileFindings = findings.filter(
		(finding) => finding.location?.filePath === file.newPath,
	);

	if (
		fileFindings.some((finding) => finding.severity === "high") ||
		(isSensitivePath(file.newPath) && file.additions > 20)
	) {
		return "high";
	}

	if (
		fileFindings.some((finding) => finding.severity === "medium") ||
		file.additions > 80 ||
		isPackageFile(file.newPath) ||
		isSensitivePath(file.newPath)
	) {
		return "medium";
	}

	return "low";
}

function buildLocation(
	file: ParsedDiffFile,
	line: ParsedDiffLine,
): ReviewIssue["location"] {
	return {
		filePath: file.newPath,
		lineNumber: line.newLineNumber ?? undefined,
		codeSnippet: line.content.trim() || line.content,
	};
}

function hasNearbyErrorHandling(lines: ParsedDiffLine[], lineIndex: number) {
	const nearbyAddedLines = lines
		.slice(Math.max(0, lineIndex - 4), lineIndex + 5)
		.filter((line) => line.type === "add")
		.map((line) => line.content.toLowerCase());

	return nearbyAddedLines.some((line) =>
		/\b(try|catch|finally|response\.ok|throw new error|error state|seterror)\b/.test(
			line,
		),
	);
}

function stripCategory(finding: Finding): ReviewIssue {
	const { title, severity, location, description, suggestedFix } = finding;

	return { title, severity, location, description, suggestedFix };
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

function buildRiskFactors(
	files: ParsedDiffFile[],
	findings: Finding[],
): RiskFactor[] {
	const factors: RiskFactor[] = [];
	const mediumIssues = findings.filter(
		(finding) => finding.severity === "medium",
	).length;
	const highIssues = findings.filter(
		(finding) => finding.severity === "high",
	).length;
	const packageFiles = files.filter(
		(file) =>
			isPackageFile(file.newPath) && file.additions + file.deletions > 0,
	);
	const sensitiveFiles = files.filter((file) =>
		isSensitivePath(file.newPath),
	);
	const largeFiles = files.filter((file) => file.additions > 80);
	const dangerousHtmlLines = countAddedLines(
		files,
		/\bdangerouslysetinnerhtml\b/i,
	);
	const weakTypeLines = countAddedLines(files, /\bany\b/i);
	const cleanupLines = countAddedLines(files, /\bconsole\.log\b|\btodo\b/i);
	const missingErrorHandling = findings.filter((finding) =>
		finding.title.includes("Network request"),
	).length;

	if (mediumIssues > 0) {
		factors.push({
			label: "Medium-severity findings",
			impact: mediumIssues * 10,
			severity: "medium",
			reason: `${mediumIssues} medium review finding${mediumIssues === 1 ? "" : "s"} add correctness or maintainability risk.`,
		});
	}

	if (highIssues > 0) {
		factors.push({
			label: "High-severity findings",
			impact: highIssues * 20,
			severity: "high",
			reason: `${highIssues} high-severity finding${highIssues === 1 ? "" : "s"} indicate security or production-impacting risk.`,
		});
	}

	if (packageFiles.length > 0) {
		factors.push({
			label: "Dependency or script changes",
			impact: packageFiles.length * 15,
			severity: "medium",
			reason: "package.json changes can affect dependency resolution, scripts, builds, and deployment behavior.",
		});
	}

	if (sensitiveFiles.length > 0) {
		factors.push({
			label: "Sensitive file paths",
			impact: sensitiveFiles.length * 15,
			severity: "medium",
			reason: "Auth, security, config, payment, token, or session paths have a higher blast radius when behavior changes.",
		});
	}

	if (largeFiles.length > 0) {
		factors.push({
			label: "Large changed files",
			impact: largeFiles.length * 10,
			severity: "medium",
			reason: "Files with many additions are harder to review completely and are more likely to hide behavior changes.",
		});
	}

	if (dangerousHtmlLines > 0) {
		factors.push({
			label: "Raw HTML rendering",
			impact: dangerousHtmlLines * 20,
			severity: "high",
			reason: "dangerouslySetInnerHTML can expose users to cross-site scripting unless input is sanitized at a trusted boundary.",
		});
	}

	if (missingErrorHandling > 0) {
		factors.push({
			label: "Missing network error handling",
			impact: missingErrorHandling * 10,
			severity: "medium",
			reason: "fetch or axios calls without nearby failure handling can leave loading, error, or data state inconsistent.",
		});
	}

	if (weakTypeLines > 0) {
		factors.push({
			label: "Weak TypeScript typing",
			impact: weakTypeLines * 8,
			severity: "low",
			reason: "Added any usage weakens compile-time checks and can hide incorrect assumptions about runtime data.",
		});
	}

	if (cleanupLines > 0) {
		factors.push({
			label: "Cleanup markers",
			impact: cleanupLines * 5,
			severity: "low",
			reason: "console.log and TODO additions can leave noisy output or ambiguous unfinished work in the branch.",
		});
	}

	return factors;
}

function calculateRiskScore(factors: RiskFactor[]) {
	return Math.min(
		factors.reduce((total, factor) => total + factor.impact, 0),
		100,
	);
}

function determineRiskFromScore(score: number): Severity {
	if (score >= 70) return "high";
	if (score >= 35) return "medium";
	return "low";
}

function countAddedLines(files: ParsedDiffFile[], pattern: RegExp) {
	return files.reduce((count, file) => {
		const fileCount = file.hunks.reduce((hunkCount, hunk) => {
			return (
				hunkCount +
				hunk.lines.filter(
					(line) => line.type === "add" && pattern.test(line.content),
				).length
			);
		}, 0);

		return count + fileCount;
	}, 0);
}

function determineConfidence(
	diff: string,
	findings: Finding[],
	mode: ReviewMode,
	changedFiles: ChangedFileSummary[],
) {
	const base = diff.includes("diff --git") ? 0.78 : 0.62;
	const modeBoost = mode === "general" ? 0 : 0.03;
	const structureBoost = Math.min(changedFiles.length * 0.02, 0.08);
	const findingBoost = Math.min(findings.length * 0.025, 0.12);
	return Number(
		Math.min(
			base + modeBoost + structureBoost + findingBoost,
			0.94,
		).toFixed(2),
	);
}

function buildSummary({
	mode,
	changedFiles,
	bugCount,
	refactorCount,
	overallRisk,
	riskScore,
}: {
	mode: ReviewMode;
	changedFiles: ChangedFileSummary[];
	bugCount: number;
	refactorCount: number;
	overallRisk: Severity;
	riskScore: number;
}) {
	const additions = changedFiles.reduce(
		(total, file) => total + file.additions,
		0,
	);
	const deletions = changedFiles.reduce(
		(total, file) => total + file.deletions,
		0,
	);
	const issueText =
		bugCount + refactorCount === 0
			? "no major location-aware findings"
			: `${bugCount} possible bug${bugCount === 1 ? "" : "s"} and ${refactorCount} refactoring suggestion${refactorCount === 1 ? "" : "s"}`;

	return `ReviewPilot inspected ${changedFiles.length} changed file${changedFiles.length === 1 ? "" : "s"} with ${additions} addition${additions === 1 ? "" : "s"} and ${deletions} deletion${deletions === 1 ? "" : "s"} in ${modeLabels[mode]} mode and found ${issueText}. Overall risk is ${overallRisk} with a ${riskScore}/100 score.`;
}

function isPackageFile(filePath: string) {
	return /(^|\/)package\.json$/i.test(filePath);
}

function isSensitivePath(filePath: string) {
	return /\b(auth|payment|billing|security|config|secret|token|session)\b/i.test(
		filePath,
	);
}
