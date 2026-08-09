import { describe, expect, it } from "vitest";
import { computeContentHash } from "./hash.js";
import { makeTokensFixture } from "./fixtures.js";
import type { DesignTokens } from "./types.js";

describe("computeContentHash", () => {
  it("is stable across repeated calls on the same content", () => {
    expect(computeContentHash(makeTokensFixture())).toBe(computeContentHash(makeTokensFixture()));
  });

  it("is independent of object key order", () => {
    const reordered: DesignTokens = {
      spacing: { md: { $value: "8px", $type: "dimension" }, sm: { $value: "4px", $type: "dimension" } },
      color: { surface: { disabled: { $value: "#E0E0E0", $type: "color" }, default: { $value: "#F5F5F5", $type: "color" } } },
    };
    expect(computeContentHash(reordered)).toBe(computeContentHash(makeTokensFixture()));
  });

  it("changes when a value changes", () => {
    const tokens = makeTokensFixture();
    const mutated = { ...tokens, spacing: { ...tokens.spacing, sm: { $value: "6px", $type: "dimension" as const } } };
    expect(computeContentHash(mutated)).not.toBe(computeContentHash(tokens));
  });
});
