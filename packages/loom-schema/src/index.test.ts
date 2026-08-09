import { describe, expect, it } from "vitest";
import { validateFrontmatter, validateNodeBlock, SchemaValidationError } from "./index.js";

describe("validateFrontmatter", () => {
  it("accepts a valid frontmatter object", () => {
    const fm = validateFrontmatter({ name: "checkbox", kind: "primitive", category: "form", extends: ["interactive-base"] });
    expect(fm.name).toBe("checkbox");
  });

  it("rejects a non-kebab-case name", () => {
    expect(() => validateFrontmatter({ name: "Checkbox", kind: "primitive" })).toThrow(SchemaValidationError);
  });

  it("rejects an unknown 'kind'", () => {
    expect(() => validateFrontmatter({ name: "checkbox", kind: "widget" })).toThrow(SchemaValidationError);
  });

  it("rejects unknown extra properties", () => {
    expect(() => validateFrontmatter({ name: "checkbox", kind: "primitive", bogus: true })).toThrow(SchemaValidationError);
  });
});

describe("validateNodeBlock", () => {
  it("accepts a valid prop block", () => {
    expect(validateNodeBlock({ kind: "prop", type: "bool", default: false })).toMatchObject({ kind: "prop" });
  });

  it("accepts a valid transition block", () => {
    const block = validateNodeBlock({
      kind: "transition",
      from: "unchecked",
      to: "checked",
      trigger: { kind: "event", name: "click" },
      guard: "not disabled",
    });
    expect(block.kind).toBe("transition");
  });

  it("rejects a block missing required fields for its kind", () => {
    expect(() => validateNodeBlock({ kind: "property", ident: "x" })).toThrow(SchemaValidationError);
  });

  it("rejects an unknown node kind", () => {
    expect(() => validateNodeBlock({ kind: "mystery" })).toThrow(SchemaValidationError);
  });
});
