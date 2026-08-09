import type { ComponentNode } from "loom-ir";

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
