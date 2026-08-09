import { describe, expect, it } from "vitest";
import { resolveToken, tokenExists, TokenResolutionError } from "./resolve.js";
import { makeTokensFixture } from "./fixtures.js";

describe("resolveToken", () => {
  const tokens = makeTokensFixture();

  it("resolves a nested leaf by dot path", () => {
    expect(resolveToken("color.surface.default", tokens)).toEqual({ $value: "#F5F5F5", $type: "color" });
    expect(resolveToken("spacing.md", tokens)).toEqual({ $value: "8px", $type: "dimension" });
  });

  it("throws with a precise reason for a missing segment", () => {
    expect(() => resolveToken("color.surface.hover", tokens)).toThrow(/no 'hover' under 'color.surface'/);
  });

  it("throws when the path resolves to a group, not a leaf", () => {
    expect(() => resolveToken("color.surface", tokens)).toThrow(/resolves to a group/);
  });

  it("throws when the path overshoots past a leaf", () => {
    expect(() => resolveToken("color.surface.default.hex", tokens)).toThrow(TokenResolutionError);
  });
});

describe("tokenExists", () => {
  const tokens = makeTokensFixture();

  it("is true for a resolvable path and false otherwise", () => {
    expect(tokenExists("spacing.sm", tokens)).toBe(true);
    expect(tokenExists("spacing.xl", tokens)).toBe(false);
  });
});
