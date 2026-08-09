import { describe, expect, it } from "vitest";
import { validateTokens, validateLock, computeContentHash } from "loom-tokens";
import { importFigmaVariables } from "./importer.js";
import { makeFigmaVariablesFixture } from "./fixtures.js";

describe("importFigmaVariables", () => {
  it("produces tokens that pass the tool-agnostic DTCG schema", () => {
    const { tokens } = importFigmaVariables(makeFigmaVariablesFixture(), { sourceRef: "file:abc123" });
    expect(() => validateTokens(tokens)).not.toThrow();
  });

  it("produces a lock that passes the generic lock schema and records the right content hash", () => {
    const fixedNow = () => new Date("2026-08-09T12:00:00Z");
    const { tokens, lock } = importFigmaVariables(makeFigmaVariablesFixture(), { sourceRef: "file:abc123", now: fixedNow });
    expect(() => validateLock(lock)).not.toThrow();
    expect(lock).toEqual({
      tool: "figma",
      sourceRef: "file:abc123",
      contentHash: computeContentHash(tokens),
      importedAt: "2026-08-09T12:00:00.000Z",
    });
  });

  it("is the only place that knows Figma-specific shapes — its output has no Figma-specific fields", () => {
    const { tokens, lock } = importFigmaVariables(makeFigmaVariablesFixture(), { sourceRef: "file:abc123" });
    expect(JSON.stringify(tokens)).not.toContain("Variable");
    expect(JSON.stringify(lock)).not.toContain("Variable");
  });
});
