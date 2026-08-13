import { describe, expect, it } from "vitest";
import { lower, lowerComposition, lowerRootHandlers, hasKeydownHandler } from "./lower.js";
import { makeCheckboxFixture } from "./testFixtures.js";
import type { ComponentNode, EventNode, FieldNode, SlotNode, UsesNode } from "./nodes.js";
import type { Effect, RenderNode } from "./render.js";

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

describe("lower — content prop (renders a prop as own text content)", () => {
  it("lowers a content prop to a single text render node, a bare ref to the prop", () => {
    const component = makeChildComponent("radio-button", {
      declarations: [
        { id: "radio-button/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" }, content: true },
      ],
    });
    expect(lower(component)).toEqual([{ kind: "text", value: { type: "ref", name: "label" } }]);
  });

  it("ignores declared slots when a content prop is present (checkComposition guarantees they never coexist)", () => {
    const component = makeChildComponent("weird", {
      declarations: [
        { id: "weird/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" }, content: true },
        { id: "weird/declarations/aside", kind: "slot", origin: "own", assertable: false, name: "aside" },
      ],
    });
    expect(lower(component)).toEqual([{ kind: "text", value: { type: "ref", name: "label" } }]);
  });

  it("falls back to declared slots when no prop is marked content", () => {
    const component = makeChildComponent("plain", {
      declarations: [
        { id: "plain/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" } },
        { id: "plain/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
      ],
    });
    expect(lower(component)).toEqual([{ kind: "slot", name: "default" }]);
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

describe("lowerComposition — confirmation-dialog shape (instance/fills/when/bare-sugar handler)", () => {
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
    expect(actionsFill[0]).toMatchObject({ kind: "fragment" });
    if (actionsFill[0]!.kind !== "fragment") throw new Error("unreachable");
    expect(actionsFill[0]!.children).toHaveLength(1);
    expect(actionsFill[0]!.children[0]).toMatchObject({ kind: "instance", name: "confirm-button" });
  });

  it("lowers bare-string 'on' sugar to an empty-payload emit effect", () => {
    const tree = lowerComposition(dialogUses, widget);
    const instance = tree.kind === "when" ? tree.then[0]! : tree;
    if (instance.kind !== "instance") throw new Error("unreachable");
    const actionsFill = instance.fills.actions![0]!;
    if (actionsFill.kind !== "fragment") throw new Error("unreachable");
    const confirmInstance = actionsFill.children[0]!;
    if (confirmInstance.kind !== "instance") throw new Error("unreachable");
    expect(confirmInstance.handlers).toEqual([{ on: "press", effects: [{ kind: "emit", event: "closed", payload: {} }] }]);
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
    expect(bodyFill[0]).toMatchObject({ kind: "fragment" });
    if (bodyFill[0]!.kind !== "fragment") throw new Error("unreachable");
    expect(bodyFill[0]!.children).toHaveLength(1);
    expect(bodyFill[0]!.children[0]).toMatchObject({ kind: "fragment" });
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

describe("lowerComposition — each (iteration)", () => {
  const list = makeChildComponent("list", {
    declarations: [{ id: "list/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" }],
  });
  const listItem = makeChildComponent("list-item", {
    declarations: [
      { id: "list-item/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" } },
    ],
  });
  const itemTemplate: UsesNode = {
    id: "task-list/composition/item-template",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "item-template",
    component: "list-item",
    resolvedComponent: listItem,
    props: { label: { expr: { type: "member", target: { type: "ref", name: "task" }, property: "label" } } },
  };
  const listUses: UsesNode = {
    id: "task-list/composition/list-instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "list-instance",
    component: "list",
    resolvedComponent: list,
    root: true,
    slotContent: { default: { each: { over: "tasks", as: "task", use: "item-template", key: "id" } } },
  };
  const taskList = makeChildComponent("task-list", { composition: [listUses, itemTemplate] });

  it("lowers an each slotContent to a single 'each' render node filling the slot", () => {
    const tree = lowerComposition(listUses, taskList);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const fill = tree.fills.default!;
    expect(fill).toHaveLength(1);
    expect(fill[0]).toMatchObject({ kind: "each", ident: "task", over: { type: "ref", name: "tasks" } });
  });

  it("sets 'key' to a member expr over the bound ident, from each.key", () => {
    const tree = lowerComposition(listUses, taskList);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const each = tree.fills.default![0] as Extract<RenderNode, { kind: "each" }>;
    expect(each.key).toEqual({ type: "member", target: { type: "ref", name: "task" }, property: "id" });
  });

  it("leaves 'key' undefined when each.key is omitted", () => {
    const noKey: UsesNode = { ...listUses, slotContent: { default: { each: { over: "tasks", as: "task", use: "item-template" } } } };
    const tree = lowerComposition(noKey, { ...taskList, composition: [noKey, itemTemplate] });
    if (tree.kind !== "instance") throw new Error("unreachable");
    const each = tree.fills.default![0] as Extract<RenderNode, { kind: "each" }>;
    expect(each.key).toBeUndefined();
  });

  it("lowers each.use's node once, as the each's own body — its computed prop keeps the bound-ident-referencing expr untouched", () => {
    const tree = lowerComposition(listUses, taskList);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const each = tree.fills.default![0] as Extract<RenderNode, { kind: "each" }>;
    expect(each.body).toHaveLength(1);
    expect(each.body[0]).toMatchObject({ kind: "instance", name: "item-template" });
    if (each.body[0]!.kind !== "instance") throw new Error("unreachable");
    expect(each.body[0]!.props.label).toEqual({ type: "member", target: { type: "ref", name: "task" }, property: "label" });
  });
});

describe("lowerComposition — each.selects (shared selection)", () => {
  const radioButton = makeChildComponent("radio-button", {
    declarations: [
      { id: "radio-button/declarations/value", kind: "prop", origin: "own", assertable: false, name: "value", valueType: { kind: "string" } },
      {
        id: "radio-button/declarations/press",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "press",
        payloadType: { kind: "record", fields: {} },
      },
    ],
  });
  const list = makeChildComponent("list", {
    declarations: [{ id: "list/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" }],
  });

  function makeRadioGroup(templateOn: UsesNode["on"]): { component: ComponentNode; listUses: UsesNode } {
    const template: UsesNode = {
      id: "radio-group/composition/option-template",
      kind: "uses",
      origin: "own",
      assertable: false,
      name: "option-template",
      component: "radio-button",
      resolvedComponent: radioButton,
      on: templateOn,
    };
    const listUses: UsesNode = {
      id: "radio-group/composition/list-instance",
      kind: "uses",
      origin: "own",
      assertable: false,
      name: "list-instance",
      component: "list",
      resolvedComponent: list,
      root: true,
      slotContent: {
        default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "selected", field: "value" } } },
      },
    };
    const component = makeChildComponent("radio-group", { composition: [listUses, template] });
    return { component, listUses };
  }

  function lowerTemplateInstance(component: ComponentNode, listUses: UsesNode): Extract<RenderNode, { kind: "instance" }> {
    const tree = lowerComposition(listUses, component);
    if (tree.kind !== "instance") throw new Error("unreachable");
    const each = tree.fills.default![0] as Extract<RenderNode, { kind: "each" }>;
    const template = each.body[0]!;
    if (template.kind !== "instance") throw new Error("unreachable");
    return template;
  }

  it("merges a set-cell effect into the same Handler the template's own 'on' wiring already produces for that event", () => {
    const { component, listUses } = makeRadioGroup({ press: { event: "option-selected", payload: {} } });
    const template = lowerTemplateInstance(component, listUses);
    expect(template.handlers).toHaveLength(1);
    expect(template.handlers[0]!.on).toBe("press");
    expect(template.handlers[0]!.effects).toEqual([
      { kind: "emit", event: "option-selected", payload: {} },
      {
        kind: "set-cell",
        cell: "selected",
        from: { kind: "expr", expr: { type: "member", target: { type: "ref", name: "option" }, property: "value" } },
      },
    ]);
  });

  it("adds a new one-effect Handler when the template declares no 'on' wiring for that event at all", () => {
    const { component, listUses } = makeRadioGroup(undefined);
    const template = lowerTemplateInstance(component, listUses);
    expect(template.handlers).toEqual([
      {
        on: "press",
        effects: [
          {
            kind: "set-cell",
            cell: "selected",
            from: { kind: "expr", expr: { type: "member", target: { type: "ref", name: "option" }, property: "value" } },
          },
        ],
      },
    ]);
  });

  it("lowers a dotted on-payload source (<as>.<field>) to a member expr over the bound ident", () => {
    const { component, listUses } = makeRadioGroup({ press: { event: "option-selected", payload: { value: "option.value" } } });
    const template = lowerTemplateInstance(component, listUses);
    const emitEffect = template.handlers[0]!.effects[0]! as Extract<Effect, { kind: "emit" }>;
    expect(emitEffect.payload.value).toEqual({ type: "member", target: { type: "ref", name: "option" }, property: "value" });
  });
});

describe("lowerRootHandlers", () => {
  it("returns nothing for a component with no machine and no triggered events", () => {
    const noMachine: ComponentNode = { ...makeCheckboxFixture(), states: [], transitions: [] };
    expect(lowerRootHandlers(noMachine)).toEqual([]);
  });

  it("lowers a machine transition's trigger to a dispatch effect, grouped by trigger name", () => {
    const handlers = lowerRootHandlers(makeCheckboxFixture());
    expect(handlers).toEqual([{ on: "click", effects: [{ kind: "dispatch", event: "click" }] }]);
  });

  it("lowers a declared event's own trigger to an empty-payload emit effect — no machine needed", () => {
    const press: EventNode = {
      id: "button/declarations/press",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "press",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "event", name: "click" },
    };
    const noMachine: ComponentNode = { ...makeCheckboxFixture(), states: [], transitions: [], declarations: [press] };
    expect(lowerRootHandlers(noMachine)).toEqual([{ on: "click", effects: [{ kind: "emit", event: "press", payload: {} }] }]);
  });

  it("merges a machine dispatch and a triggered event sharing the same trigger name into one handler", () => {
    const opened: EventNode = {
      id: "widget/declarations/opened",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "opened",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "event", name: "click" },
    };
    const withBoth: ComponentNode = { ...makeCheckboxFixture(), declarations: [...makeCheckboxFixture().declarations, opened] };
    const handlers = lowerRootHandlers(withBoth);
    expect(handlers).toEqual([
      { on: "click", effects: [{ kind: "dispatch", event: "click" }, { kind: "emit", event: "opened", payload: {} }] },
    ]);
  });

  it("lowers a declared event's kind:key trigger to a keydown handler carrying its key (§ Phase 5d)", () => {
    const activated: EventNode = {
      id: "widget/declarations/activated",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "activated",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "key", key: "Enter" },
    };
    const noMachine: ComponentNode = { ...makeCheckboxFixture(), states: [], transitions: [], declarations: [activated] };
    expect(lowerRootHandlers(noMachine)).toEqual([
      { on: "keydown", key: "Enter", effects: [{ kind: "emit", event: "activated", payload: {} }] },
    ]);
  });

  it("merges two declared events sharing the exact same key into one keydown handler", () => {
    const dismissed: EventNode = {
      id: "widget/declarations/dismissed",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "dismissed",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "key", key: "Escape" },
    };
    const cancelled: EventNode = {
      id: "widget/declarations/cancelled",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "cancelled",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "key", key: "Escape" },
    };
    const noMachine: ComponentNode = { ...makeCheckboxFixture(), states: [], transitions: [], declarations: [dismissed, cancelled] };
    expect(lowerRootHandlers(noMachine)).toEqual([
      {
        on: "keydown",
        key: "Escape",
        effects: [
          { kind: "emit", event: "dismissed", payload: {} },
          { kind: "emit", event: "cancelled", payload: {} },
        ],
      },
    ]);
  });

  it("does not produce a handler for a pointer trigger — declarable but inert", () => {
    const pointerTriggered: EventNode = {
      id: "widget/declarations/activated",
      kind: "event",
      origin: "own",
      assertable: false,
      name: "activated",
      payloadType: { kind: "record", fields: {} },
      trigger: { kind: "pointer", name: "hover" },
    };
    const noMachine: ComponentNode = { ...makeCheckboxFixture(), states: [], transitions: [], declarations: [pointerTriggered] };
    expect(lowerRootHandlers(noMachine)).toEqual([]);
  });

  it("does not wire a machine transition's key trigger to dispatch — Transition.matches still hardcodes kind:event (§ Phase 5a)", () => {
    const keyTransition = { ...makeCheckboxFixture().transitions[0]!, trigger: { kind: "key" as const, key: "Enter" } };
    const withKeyTransition: ComponentNode = { ...makeCheckboxFixture(), transitions: [keyTransition] };
    expect(lowerRootHandlers(withKeyTransition)).toEqual([]);
  });
});

describe("hasKeydownHandler", () => {
  it("is true when lowerRootHandlers produced a keydown handler", () => {
    expect(hasKeydownHandler([{ on: "keydown", key: "Escape", effects: [] }])).toBe(true);
  });

  it("is false otherwise", () => {
    expect(hasKeydownHandler([{ on: "click", effects: [] }])).toBe(false);
    expect(hasKeydownHandler([])).toBe(false);
  });
});
