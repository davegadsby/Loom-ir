import { describe, expect, it } from "vitest";
import { validateTokens, validateLock, SchemaValidationError } from "./validate.js";
import { makeTokensFixture } from "./fixtures.js";

describe("validateTokens", () => {
  it("accepts a well-formed tokens tree", () => {
    expect(validateTokens(makeTokensFixture())).toEqual(makeTokensFixture());
  });

  it("rejects a leaf missing $type", () => {
    expect(() => validateTokens({ color: { primary: { $value: "#000" } } })).toThrow(SchemaValidationError);
  });

  it("rejects an unknown $type", () => {
    expect(() => validateTokens({ color: { primary: { $value: "#000", $type: "hue" } } })).toThrow(SchemaValidationError);
  });
});

describe("validateLock", () => {
  it("accepts a well-formed lock", () => {
    const lock = { tool: "figma", sourceRef: "file:abc123", contentHash: "deadbeef", importedAt: "2026-08-09T00:00:00Z" };
    expect(validateLock(lock)).toEqual(lock);
  });

  it("rejects a lock missing a required field", () => {
    expect(() => validateLock({ tool: "figma", contentHash: "x", importedAt: "y" })).toThrow(SchemaValidationError);
  });
});
