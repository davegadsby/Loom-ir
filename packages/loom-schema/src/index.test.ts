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

  it("accepts a valid uses block with slotContent and on/visibleWhen", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "dialog",
      root: true,
      visibleWhen: "open",
      slotContent: {
        title: { text: "Confirm Deletion" },
        actions: { uses: ["confirm-button"] },
      },
      on: { press: "closed" },
    });
    expect(block.kind).toBe("uses");
  });

  it("rejects a uses block missing the required 'component' field", () => {
    expect(() => validateNodeBlock({ kind: "uses" })).toThrow(SchemaValidationError);
  });

  it("rejects a slotContent entry that is neither text nor uses", () => {
    expect(() =>
      validateNodeBlock({ kind: "uses", component: "dialog", slotContent: { title: { bogus: true } } })
    ).toThrow(SchemaValidationError);
  });

  it("accepts an event block with firesWhen", () => {
    const block = validateNodeBlock({
      kind: "event",
      payloadType: "record{}",
      firesWhen: { prop: "open", becomes: true },
    });
    expect(block.kind).toBe("event");
  });
});
