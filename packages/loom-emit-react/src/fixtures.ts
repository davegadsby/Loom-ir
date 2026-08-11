import type { ComponentNode, FieldNode, UsesNode } from "loom-ir";
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
        pattern: "checkbox",
      },
    ],
    style: [],
    composition: [],
    prose: [],
  };
  return component;
}

/** `makeFixture` plus a token-ref/layout-intent on root and a token-ref on the `helper-text` slot. */
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
    {
      id: "checkbox/style/helper-text-color",
      kind: "token-ref",
      origin: "own",
      assertable: true,
      part: "helper-text",
      property: "color",
      token: "color.surface.disabled",
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
 * `confirmation-dialog`'s real shape, small enough to assert exact output
 * against. Also exercises `opened`'s `firesWhen`.
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
 * one click — small enough to assert exact output against, but exercising
 * native field rendering, computed props, and multi-target `on` together.
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
 * instead of repeating the expression.
 *
 * Deliberately single-word, not `submit-disabled`: `loom-expr`'s identifier
 * lexer has no hyphen in its grammar (`[A-Za-z_][A-Za-z0-9_]*`), so a
 * hyphenated name can never be *referenced* from expression text at all —
 * `parseExpr("submit-disabled")` parses as the binop `submit - disabled`,
 * not a single ref, and fails to typecheck as an unresolved reference. This
 * isn't new to `derived` — it silently affects any kebab-case prop or field
 * name too, just unexercised until a name needed referencing from
 * expression text (every existing example's referenced names happen to be
 * single words). Tracked as a known gap in `DerivedNode`'s doc comment and
 * `AGENTS.md`, not fixed here.
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
 * (`task.label`/`task.done`), exercising `printPropExpr`'s bound-ident env
 * merge and its non-bool cast path (`label` is `string`, not `bool` — no
 * existing fixture before this one ever computed a non-bool `{expr}` prop).
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
