export type ParsedDiff = {
	files: ParsedDiffFile[];
};

export type ParsedDiffFile = {
	oldPath: string | null;
	newPath: string;
	language: string;
	additions: number;
	deletions: number;
	hunks: ParsedDiffHunk[];
};

export type ParsedDiffHunk = {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: ParsedDiffLine[];
};

export type ParsedDiffLine = {
	type: "add" | "delete" | "context";
	content: string;
	oldLineNumber: number | null;
	newLineNumber: number | null;
};

const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(diff: string): ParsedDiff {
	const files: ParsedDiffFile[] = [];
	const lines = diff.replace(/\r\n/g, "\n").split("\n");

	let currentFile: ParsedDiffFile | null = null;
	let currentHunk: ParsedDiffHunk | null = null;
	let oldLineNumber = 0;
	let newLineNumber = 0;

	for (const rawLine of lines) {
		if (rawLine.startsWith("diff --git ")) {
			const paths = rawLine.match(/^diff --git a\/(.+) b\/(.+)$/);
			currentFile = {
				oldPath: paths?.[1] ?? null,
				newPath: paths?.[2] ?? "unknown",
				language: getLanguage(paths?.[2] ?? "unknown"),
				additions: 0,
				deletions: 0,
				hunks: [],
			};
			files.push(currentFile);
			currentHunk = null;
			continue;
		}

		if (!currentFile) continue;

		if (rawLine.startsWith("--- ")) {
			currentFile.oldPath = parseHeaderPath(rawLine.slice(4));
			continue;
		}

		if (rawLine.startsWith("+++ ")) {
			const newPath = parseHeaderPath(rawLine.slice(4));
			if (newPath) {
				currentFile.newPath = newPath;
				currentFile.language = getLanguage(newPath);
			}
			continue;
		}

		const hunkMatch = rawLine.match(hunkHeaderPattern);
		if (hunkMatch) {
			currentHunk = {
				oldStart: Number(hunkMatch[1]),
				oldLines: Number(hunkMatch[2] ?? 1),
				newStart: Number(hunkMatch[3]),
				newLines: Number(hunkMatch[4] ?? 1),
				lines: [],
			};
			oldLineNumber = currentHunk.oldStart;
			newLineNumber = currentHunk.newStart;
			currentFile.hunks.push(currentHunk);
			continue;
		}

		if (
			!currentHunk ||
			rawLine.startsWith("\\ No newline at end of file")
		) {
			continue;
		}

		if (rawLine.startsWith("+")) {
			currentHunk.lines.push({
				type: "add",
				content: rawLine.slice(1),
				oldLineNumber: null,
				newLineNumber,
			});
			currentFile.additions += 1;
			newLineNumber += 1;
			continue;
		}

		if (rawLine.startsWith("-")) {
			currentHunk.lines.push({
				type: "delete",
				content: rawLine.slice(1),
				oldLineNumber,
				newLineNumber: null,
			});
			currentFile.deletions += 1;
			oldLineNumber += 1;
			continue;
		}

		const content = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
		currentHunk.lines.push({
			type: "context",
			content,
			oldLineNumber,
			newLineNumber,
		});
		oldLineNumber += 1;
		newLineNumber += 1;
	}

	return { files };
}

function parseHeaderPath(path: string) {
	if (path === "/dev/null") return null;
	return path.replace(/^[ab]\//, "");
}

function getLanguage(filePath: string) {
	const normalized = filePath.toLowerCase();

	if (normalized.endsWith(".tsx")) return "TSX";
	if (normalized.endsWith(".ts")) return "TypeScript";
	if (normalized.endsWith(".jsx")) return "JSX";
	if (normalized.endsWith(".js")) return "JavaScript";
	if (normalized.endsWith(".json")) return "JSON";
	if (normalized.endsWith(".css")) return "CSS";
	if (normalized.endsWith(".md")) return "Markdown";
	if (normalized.endsWith(".yml") || normalized.endsWith(".yaml")) {
		return "YAML";
	}

	return "Text";
}
