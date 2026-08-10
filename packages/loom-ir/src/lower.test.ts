import { describe, expect, it } from "vitest";
import { lower, lowerComposition } from "./lower.js";
import { makeCheckboxFixture } from "./testFixtures.js";
import type { ComponentNode, FieldNode, SlotNode, UsesNode } from "./nodes.js";
import type { RenderNode } from "./render.js";

function withSlots(...names: string[]): ComponentNode {
  const component = makeCheckboxFixture();
  const slots: SlotNode[] = names.map((name) => ({
    id: `checkbox/declarations/${name}`,
    kind: "slot",
    origin: "own",
    assertable: false,
    name,
  }));
  return { ...component, declarations: [...component.declarations, ...slots] };
}

describe("lower — non-composition slots", () => {
  it("produces no render nodes for a component with no declared slots", () => {
    expect(lower(makeCheckboxFixture())).toEqual([]);
  });

  it("lowers each declared slot to a slot render node, in declaration order", () => {
    const tree = lower(withSlots("title", "body", "actions"));
    expect(tree).toEqual([
      { kind: "slot", name: "title" },
      { kind: "slot", name: "body" },
      { kind: "slot", name: "actions" },
    ]);
  });

  it("preserves declaration order even when 'default' is not first — printers, not lower(), decide display order", () => {
    const tree = lower(withSlots("default", "helper-text"));
    expect(tree).toEqual([
      { kind: "slot", name: "default" },
      { kind: "slot", name: "helper-text" },
    ]);
  });

  it("does not emit render nodes for non-slot declarations", () => {
    const tree = lower(withSlots("body"));
    expect(tree).toEqual([{ kind: "slot", name: "body" }]);
  });
});

function makeChildComponent(name: string, overrides: Partial<ComponentNode> = {}): ComponentNode {
  return {
    id: name,
    kind: "component",
    origin: "own",
    assertable: false,
    name,
    extends: [],
    declarations: [],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [],
    a11y: [],
    style: [],
    composition: [],
    prose: [],
    ...overrides,
  };
}

describe("lowerComposition — confirmation-dialog shape (instance/fills/when/forward-payload handler)", () => {
  const dialog = makeChildComponent("dialog", {
    declarations: [
      { id: "dialog/declarations/title", kind: "slot", origin: "own", assertable: false, name: "title" },
      { id: "dialog/declarations/actions", kind: "slot", origin: "own", assertable: false, name: "actions" },
    ],
  });
  const button = makeChildComponent("button", {
    declarations: [
      { id: "button/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
      {
        id: "button/declarations/press",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "press",
        payloadType: { kind: "record", fields: {} },
      },
    ],
  });
  const confirmButton: UsesNode = {
    id: "widget/composition/confirm-button",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "confirm-button",
    component: "button",
    resolvedComponent: button,
    slotContent: { default: { text: "Confirm" } },
    on: { press: "closed" },
  };
  const dialogUses: UsesNode = {
    id: "widget/composition/dialog-instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "dialog-instance",
    component: "dialog",
    resolvedComponent: dialog,
    root: true,
    visibleWhen: "open",
    slotContent: { title: { text: "Confirm Deletion" }, actions: { uses: ["confirm-button"] } },
  };
  const widget = makeChildComponent("widget", { composition: [dialogUses, confirmButton] });

  it("wraps the root instance in a when node keyed off visibleWhen", () => {
    const tree = lowerComposition(dialogUses, widget);
    expect(tree.kind).toBe("when");
    if (tree.kind !== "when") throw new Error("unreachable");
    expect(tree.cond).toEqual({ type: "ref", name: "open" });
    expect(tree.then).toHaveLength(1);
    expect(tree.then[0]!.kind).toBe("instance");
  });

  it("lowers a {text} slot fill to a bare text node, unwrapped", () => {
    const tree = lowerComposition(dialogUses, widget);
    const instance = tree.kind === "when" ? tree.then[0]! : tree;
    if (instance.kind !== "instance") throw new Error("unreachable");
    expect(instance.fills.title).toEqual([{ type: "literal", valueType: { kind: "string" }, value: "Confirm Deletion" }].map((v) => ({ kind: "text", value: v })));
  });

  it("lowers a {uses} slot fill to a shorthand fragment of nested instances", () => {
    const tree = lowerComposition(dialogUses, widget);
    const instance = tree.kind === "when" ? tree.then[0]! : tree;
    if (instance.kind !== "instance") throw new Error("unreachable");
    const actionsFill = instance.fills.actions!;
    expect(actionsFill).toHaveLength(1);
    expect(actionsFill[0]).toMatchObject({ kind: "fragment", style: "shorthand" });
    if (actionsFill[0]!.kind !== "fragment") throw new Error("unreachable");
    expect(actionsFill[0]!.children).toHaveLength(1);
    expect(actionsFill[0]!.children[0]).toMatchObject({ kind: "instance", name: "confirm-button" });
  });

  it("lowers bare-string 'on' sugar to a forward-payload emit effect", () => {
    const tree = lowerComposition(dialogUses, widget);
    const instance = tree.kind === "when" ? tree.then[0]! : tree;
    if (instance.kind !== "instance") throw new Error("unreachable");
    const actionsFill = instance.fills.actions![0]!;
    if (actionsFill.kind !== "fragment") throw new Error("unreachable");
    const confirmInstance = actionsFill.children[0]!;
    if (confirmInstance.kind !== "instance") throw new Error("unreachable");
    expect(confirmInstance.handlers).toEqual([{ on: "press", effects: [{ kind: "emit", event: "closed", payload: "forward" }] }]);
  });

  it("omits the when wrapper entirely when the root has no visibleWhen", () => {
    const noGate: UsesNode = { ...dialogUses, visibleWhen: undefined };
    const tree = lowerComposition(noGate, { ...widget, composition: [noGate, confirmButton] });
    expect(tree.kind).toBe("instance");
  });
});

describe("lowerComposition — login-dialog shape (fields, computed prop, multi-target on)", () => {
  const dialog = makeChildComponent("dialog", {
    declarations: [{ id: "dialog/declarations/body", kind: "slot", origin: "own", assertable: false, name: "body" }],
  });
  const button = makeChildComponent("button", {
    declarations: [
      {
        id: "button/declarations/disabled",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "disabled",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
    ],
  });
  const username: FieldNode = {
    id: "login/declarations/username",
    kind: "field",
    origin: "own",
    assertable: false,
    name: "username",
    validate: { type: "builtin", name: "matches", args: [{ type: "ref", name: "username" }, { type: "literal", valueType: { kind: "string" }, value: "^.+$" }] },
    invalidMessage: "Enter a valid email address.",
  };
  const loginButton: UsesNode = {
    id: "login/composition/login-button",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "login-button",
    component: "button",
    resolvedComponent: button,
    props: { disabled: { expr: { type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } } } },
    on: { press: [{ event: "login", payload: { username: "username" } }, { event: "closed" }] },
  };
  const dialogUses: UsesNode = {
    id: "login/composition/dialog-instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "dialog-instance",
    component: "dialog",
    resolvedComponent: dialog,
    root: true,
    slotContent: { body: { fields: ["username"] } },
  };
  const login = makeChildComponent("login-dialog", { declarations: [username], composition: [dialogUses, loginButton] });

  it("lowers a {fields} slot fill to a shorthand fragment of per-field explicit fragments", () => {
    const tree = lowerComposition(dialogUses, login);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const bodyFill = tree.fills.body!;
    expect(bodyFill).toHaveLength(1);
    expect(bodyFill[0]).toMatchObject({ kind: "fragment", style: "shorthand" });
    if (bodyFill[0]!.kind !== "fragment") throw new Error("unreachable");
    expect(bodyFill[0]!.children).toHaveLength(1);
    expect(bodyFill[0]!.children[0]).toMatchObject({ kind: "fragment", style: "explicit" });
  });

  it("lowers a field to an <input> element plus a when-gated error span, referencing hyphenated touched/valid idents", () => {
    const tree = lowerComposition(dialogUses, login);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const fieldFragment = (tree.fills.body![0] as Extract<RenderNode, { kind: "fragment" }>).children[0]!;
    if (fieldFragment.kind !== "fragment") throw new Error("unreachable");
    expect(fieldFragment.children).toHaveLength(2);
    expect(fieldFragment.children[0]).toMatchObject({ kind: "element", tag: "input" });
    const whenNode = fieldFragment.children[1]!;
    expect(whenNode).toMatchObject({
      kind: "when",
      cond: {
        type: "binop",
        op: "and",
        left: { type: "ref", name: "username-touched" },
        right: { type: "unop", op: "not", expr: { type: "ref", name: "username-valid" } },
      },
    });
  });

  it("lowers a computed {expr} prop to its real expression, not a literal", () => {
    const tree = lowerComposition(dialogUses, login);
    if (tree.kind !== "instance") throw new Error("unreachable");
    // login-button is reached via `on`-wiring's sibling lookup in the real component,
    // but here it's a leaf never claimed by a slot — lower it directly to check props in isolation.
    const loweredButton = lowerComposition(loginButton, { ...login, composition: [loginButton] });
    if (loweredButton.kind !== "instance") throw new Error("unreachable");
    expect(loweredButton.props.disabled).toEqual({ type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } });
  });

  it("lowers a multi-target 'on' wire to multiple emit effects, non-forward payloads as ref expressions", () => {
    const loweredButton = lowerComposition(loginButton, { ...login, composition: [loginButton] });
    if (loweredButton.kind !== "instance") throw new Error("unreachable");
    expect(loweredButton.handlers).toEqual([
      {
        on: "press",
        effects: [
          { kind: "emit", event: "login", payload: { username: { type: "ref", name: "username" } } },
          { kind: "emit", event: "closed", payload: {} },
        ],
      },
    ]);
  });
});
