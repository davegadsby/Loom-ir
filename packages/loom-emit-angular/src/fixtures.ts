import type { ComponentNode, FieldNode, SelectionNode, UsesNode } from "loom-ir";
import { parseExpr } from "loom-expr";

/** Exercises props, an event, a slot, an unsupported method, and a guarded machine. */
export function makeFixture(): ComponentNode {
  const component: ComponentNode = {
    id: "checkbox",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "checkbox",
    extends: [],
    declarations: [
      {
        id: "checkbox/declarations/disabled",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "disabled",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
      {
        id: "checkbox/declarations/checked",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "checked",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
      {
        id: "checkbox/declarations/change",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "change",
        payloadType: { kind: "record", fields: { checked: { kind: "bool" } } },
      },
      { id: "checkbox/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
      { id: "checkbox/declarations/helper-text", kind: "slot", origin: "own", assertable: false, name: "helper-text" },
      {
        id: "checkbox/declarations/focus",
        kind: "method",
        origin: "own",
        assertable: false,
        name: "focus",
        params: [],
        returnType: { kind: "record", fields: {} },
      },
    ],
    states: [
      { id: "checkbox/machine/unchecked", kind: "state", origin: "own", assertable: false, name: "unchecked", flags: { disabled: false } },
      { id: "checkbox/machine/checked", kind: "state", origin: "own", assertable: false, name: "checked", flags: { disabled: false } },
    ],
    transitions: [
      {
        id: "checkbox/machine/toggle-on",
        kind: "transition",
        origin: "own",
        assertable: false,
        name: "toggle-on",
        from: "unchecked",
        to: "checked",
        trigger: { kind: "event", name: "click" },
        guard: { type: "unop", op: "not", expr: { type: "ref", name: "disabled" } },
      },
    ],
    guards: [],
    rules: [],
    claims: [],
    a11y: [
      {
        id: "checkbox/a11y/checkbox-pattern",
        kind: "pattern-conformance",
        origin: "own",
        assertable: true,
        verify: "a11y",
        // Deliberately not "checkbox" — this fixture declares slots to exercise generic
        // slot-rendering logic, and the checkbox pattern now prints a real, childless
        // `<input type="checkbox">` (§ Phase 5e), which cannot render slots at all. A
        // neutral pattern name keeps this fixture testing what it's actually for; the real
        // checkbox-as-`<input>` mechanism is proven against the real spec instead (see
        // examples/specs/checkbox.md + examples/tests/render.test.tsx).
        pattern: "widget",
      },
    ],
    style: [],
    composition: [],
    prose: [],
  };
  return component;
}

/** `makeFixture` plus a token-ref/layout-intent on root — Angular only ever has a root DOM node it controls. */
export function makeStyledFixture(): ComponentNode {
  const component = makeFixture();
  component.style = [
    {
      id: "checkbox/style/root-background",
      kind: "token-ref",
      origin: "own",
      assertable: true,
      part: "root",
      property: "background-color",
      token: "color.surface.default",
    },
    {
      id: "checkbox/style/root-layout",
      kind: "layout-intent",
      origin: "own",
      assertable: true,
      part: "root",
      display: "flex",
      gapToken: "spacing.sm",
    },
  ];
  return component;
}

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

/**
 * A `widget` composing a `dialog` (root, `visibleWhen: open`, a literal
 * `title` and a nested `actions` slot) with a leaf `confirm-button` wired to
 * fire `widget`'s own `closed` event on click — a small stand-in for
 * `confirmation-dialog`'s real shape, mirroring loom-emit-react's fixture of
 * the same name. Also exercises `opened`'s `firesWhen`.
 */
export function makeCompositionFixture(): ComponentNode {
  const dialog = makeChildComponent("dialog", {
    declarations: [
      { id: "dialog/declarations/title", kind: "slot", origin: "own", assertable: false, name: "title" },
      { id: "dialog/declarations/actions", kind: "slot", origin: "own", assertable: false, name: "actions" },
    ],
  });
  const button = makeChildComponent("button", {
    declarations: [
      {
        id: "button/declarations/variant",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "variant",
        valueType: { kind: "string" },
      },
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
    props: { variant: "primary" },
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
    slotContent: {
      title: { text: "Confirm Deletion" },
      actions: { uses: ["confirm-button"] },
    },
  };

  return makeChildComponent("widget", {
    declarations: [
      {
        id: "widget/declarations/open",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "open",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
      {
        id: "widget/declarations/opened",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "opened",
        payloadType: { kind: "record", fields: {} },
        firesWhen: { prop: "open", becomes: true },
      },
      {
        id: "widget/declarations/closed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "closed",
        payloadType: { kind: "record", fields: {} },
      },
    ],
    composition: [dialogUses, confirmButton],
  });
}

/**
 * A `login-widget` composing a `dialog` (root, `body` slot rendered as a
 * native `username` `FieldNode`) with a leaf `login-button` whose `disabled`
 * prop is a `{expr}` computed live from the field's derived validity, wired
 * to fire two of `login-widget`'s own events (with a constructed payload) on
 * one click — mirrors loom-emit-react's fixture of the same name.
 */
export function makeLoginFixture(): ComponentNode {
  const dialog = makeChildComponent("dialog", {
    declarations: [
      { id: "dialog/declarations/body", kind: "slot", origin: "own", assertable: false, name: "body" },
      { id: "dialog/declarations/actions", kind: "slot", origin: "own", assertable: false, name: "actions" },
    ],
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

  const username: FieldNode = {
    id: "login-widget/declarations/username",
    kind: "field",
    origin: "own",
    assertable: false,
    name: "username",
    validate: parseExpr('matches(username, "^[^@]+@[^@]+$")'),
    invalidMessage: "Enter a valid email address.",
  };

  const loginButton: UsesNode = {
    id: "login-widget/composition/login-button",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "login-button",
    component: "button",
    resolvedComponent: button,
    props: { disabled: { expr: parseExpr("not usernameValid") } },
    slotContent: { default: { text: "Login" } },
    on: {
      press: [
        { event: "login", payload: { username: "username" } },
        { event: "closed" },
      ],
    },
  };

  const dialogUses: UsesNode = {
    id: "login-widget/composition/dialog-instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "dialog-instance",
    component: "dialog",
    resolvedComponent: dialog,
    root: true,
    slotContent: {
      body: { fields: ["username"] },
      actions: { uses: ["login-button"] },
    },
  };

  return makeChildComponent("login-widget", {
    declarations: [
      username,
      {
        id: "login-widget/declarations/login",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "login",
        payloadType: { kind: "record", fields: { username: { kind: "string" } } },
      },
      {
        id: "login-widget/declarations/closed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "closed",
        payloadType: { kind: "record", fields: {} },
      },
    ],
    composition: [dialogUses, loginButton],
  });
}

/**
 * A `signup-widget` declaring one field (`email`) and one *authored*
 * `derived` value (`invalid`) computed from that field's own derived
 * validity, referenced by name from a composed button's `{expr}` prop
 * instead of repeating the expression. Mirrors loom-emit-react's fixture of
 * the same name — see its own doc comment for why `invalid` is
 * deliberately single-word, not `submit-disabled`.
 */
export function makeDerivedFixture(): ComponentNode {
  const dialog = makeChildComponent("dialog", {
    declarations: [
      { id: "dialog/declarations/body", kind: "slot", origin: "own", assertable: false, name: "body" },
      { id: "dialog/declarations/actions", kind: "slot", origin: "own", assertable: false, name: "actions" },
    ],
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
      { id: "button/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
    ],
  });

  const email: FieldNode = {
    id: "signup-widget/declarations/email",
    kind: "field",
    origin: "own",
    assertable: false,
    name: "email",
    validate: parseExpr('matches(email, "^[^@]+@[^@]+$")'),
    invalidMessage: "Enter a valid email address.",
  };

  const invalid = {
    id: "signup-widget/declarations/invalid",
    kind: "derived" as const,
    origin: "own" as const,
    assertable: false as const,
    name: "invalid",
    valueType: { kind: "bool" as const },
    expr: parseExpr("not emailValid"),
  };

  const submitButton: UsesNode = {
    id: "signup-widget/composition/submit-button",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "submit-button",
    component: "button",
    resolvedComponent: button,
    props: { disabled: { expr: parseExpr("invalid") } },
    slotContent: { default: { text: "Sign up" } },
  };

  const dialogUses: UsesNode = {
    id: "signup-widget/composition/dialog-instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "dialog-instance",
    component: "dialog",
    resolvedComponent: dialog,
    root: true,
    slotContent: {
      body: { fields: ["email"] },
      actions: { uses: ["submit-button"] },
    },
  };

  return makeChildComponent("signup-widget", {
    declarations: [email, invalid],
    composition: [dialogUses, submitButton],
  });
}

/**
 * A `task-list` composing a `list` (root, one `default` slot) whose slot is
 * filled by an `each` over `tasks` — a `list<record{id,label,done}>` prop —
 * instantiating a leaf `list-item` template once per element. The template's
 * `label`/`done` props are `{expr}`s referencing the bound `task` ident
 * (`task.label`/`task.done`), exercising the parameterized-method
 * (lambda-lifted) form of a computed-prop and its non-bool cast path
 * (`label` is `string`, not `bool` — no existing fixture before this one
 * ever computed a non-bool `{expr}` prop).
 */
export function makeEachFixture(): ComponentNode {
  const list = makeChildComponent("list", {
    declarations: [{ id: "list/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" }],
  });
  const listItem = makeChildComponent("list-item", {
    declarations: [
      { id: "list-item/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" } },
      { id: "list-item/declarations/done", kind: "prop", origin: "own", assertable: false, name: "done", valueType: { kind: "bool" }, defaultValue: false },
    ],
  });

  const itemsProp = {
    id: "task-list/declarations/tasks",
    kind: "prop" as const,
    origin: "own" as const,
    assertable: false as const,
    name: "tasks",
    valueType: { kind: "list" as const, of: { kind: "record" as const, fields: { id: { kind: "string" as const }, label: { kind: "string" as const }, done: { kind: "bool" as const } } } },
    defaultValue: [],
  };

  const itemTemplate: UsesNode = {
    id: "task-list/composition/item-template",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "item-template",
    component: "list-item",
    resolvedComponent: listItem,
    props: {
      label: { expr: parseExpr("task.label") },
      done: { expr: parseExpr("task.done") },
    },
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

  return makeChildComponent("task-list", {
    declarations: [itemsProp],
    composition: [listUses, itemTemplate],
  });
}

/**
 * `radio-group`-shaped: a `SelectionNode` shared across each-templated
 * `option` instances, wired via `each.selects` — mirrors
 * `examples/material/specs/radio-group.md` closely enough to exercise the
 * same code paths that fixture's regenerated output was verified against.
 * Mirrors `loom-emit-react`'s `makeSelectionFixture` exactly.
 */
export function makeSelectionFixture(): ComponentNode {
  const list = makeChildComponent("list", {
    declarations: [{ id: "list/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" }],
  });
  const option = makeChildComponent("option", {
    declarations: [
      { id: "option/declarations/value", kind: "prop", origin: "own", assertable: false, name: "value", valueType: { kind: "string" }, defaultValue: "" },
      { id: "option/declarations/checked", kind: "prop", origin: "own", assertable: false, name: "checked", valueType: { kind: "bool" }, defaultValue: false },
      {
        id: "option/declarations/press",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "press",
        payloadType: { kind: "record", fields: {} },
        trigger: { kind: "event", name: "click" },
      },
    ],
  });

  const optionsProp = {
    id: "radio-group/declarations/options",
    kind: "prop" as const,
    origin: "own" as const,
    assertable: false as const,
    name: "options",
    valueType: { kind: "list" as const, of: { kind: "record" as const, fields: { value: { kind: "string" as const } } } },
    defaultValue: [],
  };
  const selected: SelectionNode = {
    id: "radio-group/declarations/selected",
    kind: "selection",
    origin: "own",
    assertable: false,
    name: "selected",
    valueType: { kind: "string" },
    initialValue: "a",
  };
  const optionSelectedEvent = {
    id: "radio-group/declarations/option-selected",
    kind: "event" as const,
    origin: "own" as const,
    assertable: false as const,
    name: "option-selected",
    payloadType: { kind: "record" as const, fields: { value: { kind: "string" as const } } },
  };

  const optionTemplate: UsesNode = {
    id: "radio-group/composition/option-template",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "option-template",
    component: "option",
    resolvedComponent: option,
    props: {
      value: { expr: parseExpr("option.value") },
      checked: { expr: parseExpr("selected == option.value") },
    },
    on: { press: { event: "option-selected", payload: { value: "option.value" } } },
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

  return makeChildComponent("radio-group", {
    declarations: [optionsProp, selected, optionSelectedEvent],
    composition: [listUses, optionTemplate],
  });
}

/**
 * A `profile-card` with a `profile` resource (`list<record{email:string}>`,
 * 0-or-1) and a `loaded` derived value (`not isEmpty(profile)`) — proves
 * `resource` reaches the value graph exactly the way `task-list`'s `tasks`
 * prop did for `each` (§ Phase 4), just via a distinct declaration kind.
 * Mirrors `loom-emit-react`'s `makeResourceFixture` exactly.
 */
export function makeResourceFixture(): ComponentNode {
  return makeChildComponent("profile-card", {
    declarations: [
      {
        id: "profile-card/declarations/profile",
        kind: "resource",
        origin: "own",
        assertable: false,
        name: "profile",
        dataType: { kind: "record", fields: { email: { kind: "string" } } },
      },
      {
        id: "profile-card/declarations/loaded",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "loaded",
        valueType: { kind: "bool" },
        expr: parseExpr("not isEmpty(profile)"),
      },
    ],
  });
}

/**
 * A `dismiss-widget` whose `dismissed` event fires directly off an
 * `Escape` keydown on its own root — no machine, a `kind: "key"` trigger
 * instead of `kind: "event"` (§ Phase 5d). Mirrors `loom-emit-react`'s
 * `makeKeyTriggeredEventFixture` exactly.
 */
/**
 * A machine-less, non-checkbox-pattern primitive with a `checked` bool
 * prop — the shape `examples/material/specs/radio-button.md` takes.
 * `isCheckboxPattern` is false (pattern is `"radio"`, falling into the
 * generic `<div role="...">` path), so `checked` has no native DOM
 * property of its own to bind to; `[attr.aria-checked]` is the only place
 * it reaches the DOM at all.
 */
export function makeCheckedPropFixture(): ComponentNode {
  return makeChildComponent("radio-button", {
    declarations: [
      { id: "radio-button/declarations/checked", kind: "prop", origin: "own", assertable: false, name: "checked", valueType: { kind: "bool" }, defaultValue: false },
    ],
    a11y: [{ id: "radio-button/a11y/radio-pattern", kind: "pattern-conformance", origin: "own", assertable: true, verify: "a11y", pattern: "radio" }],
  });
}

export function makeKeyTriggeredEventFixture(): ComponentNode {
  return makeChildComponent("dismiss-widget", {
    declarations: [
      {
        id: "dismiss-widget/declarations/dismissed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "dismissed",
        payloadType: { kind: "record", fields: {} },
        trigger: { kind: "key", key: "Escape" },
      },
      { id: "dismiss-widget/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
    ],
  });
}

/**
 * A minimal, slot-free checkbox-shaped component (`checked` prop,
 * `unchecked`/`checked` states, `pattern-conformance: checkbox`) — the
 * exact shape the real `examples/specs/checkbox.md` has, purpose-built to
 * unit-test the checkbox-pattern real `<input>` mechanism (§ Phase 5e) in
 * isolation from `makeFixture`, which deliberately keeps a neutral pattern
 * name because it *does* declare slots (a real checkbox can't). Mirrors
 * `loom-emit-react`'s `makeCheckboxPatternFixture` exactly.
 */
export function makeCheckboxPatternFixture(): ComponentNode {
  return makeChildComponent("check-widget", {
    declarations: [
      {
        id: "check-widget/declarations/checked",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "checked",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
    ],
    states: [
      { id: "check-widget/machine/unchecked", kind: "state", origin: "own", assertable: false, name: "unchecked", flags: {} },
      { id: "check-widget/machine/checked", kind: "state", origin: "own", assertable: false, name: "checked", flags: {} },
    ],
    transitions: [
      {
        id: "check-widget/machine/toggle",
        kind: "transition",
        origin: "own",
        assertable: false,
        name: "toggle",
        from: "unchecked",
        to: "checked",
        trigger: { kind: "event", name: "click" },
      },
    ],
    a11y: [
      {
        id: "check-widget/a11y/checkbox-pattern",
        kind: "pattern-conformance",
        origin: "own",
        assertable: true,
        verify: "a11y",
        pattern: "checkbox",
      },
    ],
  });
}
