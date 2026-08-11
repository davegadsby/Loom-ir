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

  it("accepts an event block with a trigger", () => {
    const block = validateNodeBlock({
      kind: "event",
      payloadType: "record{}",
      trigger: { kind: "event", name: "click" },
    });
    expect(block.kind).toBe("event");
  });

  it("accepts a valid field block with all optional properties", () => {
    const block = validateNodeBlock({
      kind: "field",
      secret: true,
      initialValue: "",
      validate: "len(password) >= 8",
      invalidMessage: "Password must be at least 8 characters.",
    });
    expect(block.kind).toBe("field");
  });

  it("accepts a minimal field block with only kind", () => {
    expect(validateNodeBlock({ kind: "field" })).toMatchObject({ kind: "field" });
  });

  it("accepts a valid derived block", () => {
    const block = validateNodeBlock({
      kind: "derived",
      type: "bool",
      expr: "not (usernameValid and passwordValid)",
    });
    expect(block.kind).toBe("derived");
  });

  it("rejects a derived block missing 'expr'", () => {
    expect(() => validateNodeBlock({ kind: "derived", type: "bool" })).toThrow(SchemaValidationError);
  });

  it("rejects a derived block missing 'type'", () => {
    expect(() => validateNodeBlock({ kind: "derived", expr: "true" })).toThrow(SchemaValidationError);
  });

  it("accepts a valid resource block", () => {
    const block = validateNodeBlock({ kind: "resource", dataType: "record{email: string}" });
    expect(block.kind).toBe("resource");
  });

  it("rejects a resource block missing 'dataType'", () => {
    expect(() => validateNodeBlock({ kind: "resource" })).toThrow(SchemaValidationError);
  });

  it("accepts slotContent.fields", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "dialog",
      slotContent: { body: { fields: ["username", "password"] } },
    });
    expect(block.kind).toBe("uses");
  });

  it("accepts slotContent.each with an optional key", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "list",
      slotContent: { default: { each: { over: "tasks", as: "task", use: "item-template", key: "id" } } },
    });
    expect(block.kind).toBe("uses");
  });

  it("accepts slotContent.each without key", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "list",
      slotContent: { default: { each: { over: "tasks", as: "task", use: "item-template" } } },
    });
    expect(block.kind).toBe("uses");
  });

  it("rejects slotContent.each missing a required field", () => {
    expect(() =>
      validateNodeBlock({ kind: "uses", component: "list", slotContent: { default: { each: { over: "tasks", as: "task" } } } })
    ).toThrow(SchemaValidationError);
  });

  it("accepts on as a single onWireTarget object with a payload", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "button",
      on: { press: { event: "login", payload: { username: "username", password: "password" } } },
    });
    expect(block.kind).toBe("uses");
  });

  it("accepts on as an array mixing bare-string sugar and onWireTarget objects", () => {
    const block = validateNodeBlock({
      kind: "uses",
      component: "button",
      on: { press: [{ event: "login", payload: { username: "username" } }, "closed"] },
    });
    expect(block.kind).toBe("uses");
  });

  it("rejects an onWireTarget missing the required 'event' field", () => {
    expect(() =>
      validateNodeBlock({ kind: "uses", component: "button", on: { press: { payload: { username: "username" } } } })
    ).toThrow(SchemaValidationError);
  });
});
