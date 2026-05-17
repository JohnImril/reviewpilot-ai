import { describe, expect, it } from "vitest";
import { parseDiff } from "@/lib/diff/parseDiff";
import { packageChangeDiff } from "./fixtures/package-change.diff";
import { reactUseEffectDiff } from "./fixtures/react-use-effect.diff";
import { typescriptAnyDiff } from "./fixtures/typescript-any.diff";

describe("parseDiff", () => {
	it("parses a single file diff with one hunk", () => {
		const parsed = parseDiff(reactUseEffectDiff);

		expect(parsed.files).toHaveLength(1);
		expect(parsed.files[0].hunks).toHaveLength(1);
		expect(parsed.files[0]).toMatchObject({
			oldPath: "app/components/UserSearch.tsx",
			newPath: "app/components/UserSearch.tsx",
			language: "TSX",
		});
	});

	it("parses multiple files in one diff", () => {
		const parsed = parseDiff(`${reactUseEffectDiff}\n${typescriptAnyDiff}`);

		expect(parsed.files).toHaveLength(2);
		expect(parsed.files.map((file) => file.newPath)).toEqual([
			"app/components/UserSearch.tsx",
			"lib/services/reviewService.ts",
		]);
	});

	it("correctly counts additions and deletions", () => {
		const parsed = parseDiff(reactUseEffectDiff);
		const [file] = parsed.files;

		expect(file.additions).toBe(10);
		expect(file.deletions).toBe(1);
	});

	it("correctly extracts oldPath and newPath", () => {
		const parsed = parseDiff(typescriptAnyDiff);

		expect(parsed.files[0].oldPath).toBe("lib/services/reviewService.ts");
		expect(parsed.files[0].newPath).toBe("lib/services/reviewService.ts");
	});

	it("detects language from file extension", () => {
		expect(parseDiff(reactUseEffectDiff).files[0].language).toBe("TSX");
		expect(parseDiff(typescriptAnyDiff).files[0].language).toBe(
			"TypeScript",
		);
		expect(parseDiff(packageChangeDiff).files[0].language).toBe("JSON");
	});

	it("assigns oldLineNumber and newLineNumber for context, delete, and add lines", () => {
		const parsed = parseDiff(reactUseEffectDiff);
		const hunkLines = parsed.files[0].hunks[0].lines;

		const importLine = hunkLines.find((line) =>
			line.content.includes("useEffect, useState"),
		);
		const deletedSearchLine = hunkLines.find((line) =>
			line.content.includes("searchUsers(query).then"),
		);
		const addedLoadingLine = hunkLines.find((line) =>
			line.content.includes("const [isLoading"),
		);

		expect(importLine).toMatchObject({
			type: "context",
			oldLineNumber: 1,
			newLineNumber: 1,
		});
		expect(deletedSearchLine).toMatchObject({
			type: "delete",
			oldLineNumber: 6,
			newLineNumber: null,
		});
		expect(addedLoadingLine).toMatchObject({
			type: "add",
			oldLineNumber: null,
			newLineNumber: 5,
		});
	});

	it("handles added lines, deleted lines, and context lines", () => {
		const parsed = parseDiff(reactUseEffectDiff);
		const lineTypes = new Set(
			parsed.files[0].hunks[0].lines.map((line) => line.type),
		);

		expect(lineTypes.has("add")).toBe(true);
		expect(lineTypes.has("delete")).toBe(true);
		expect(lineTypes.has("context")).toBe(true);
	});

	it("handles package.json changes", () => {
		const parsed = parseDiff(packageChangeDiff);

		expect(parsed.files[0]).toMatchObject({
			newPath: "package.json",
			language: "JSON",
			additions: 2,
			deletions: 0,
		});
	});

	it("handles empty or invalid diff input gracefully", () => {
		expect(parseDiff("").files).toEqual([]);
		expect(parseDiff("not a diff").files).toEqual([]);
	});
});
