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
