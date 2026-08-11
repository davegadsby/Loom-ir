import type { ComponentNode } from "loom-ir";
import { parseExpr } from "loom-expr";

/** A small hand-built fixture exercising invariant/property claims, a path and a11y nodes. */
export function makeFixture(): ComponentNode {
  const component: ComponentNode = {
    id: "widget",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "widget",
    extends: [],
    declarations: [
      {
        id: "widget/declarations/disabled",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "disabled",
        valueType: { kind: "bool" },
        defaultValue: false,
      },
    ],
    states: [
      { id: "widget/machine/off", kind: "state", origin: "own", assertable: false, name: "off", flags: { disabled: false } },
      { id: "widget/machine/on", kind: "state", origin: "own", assertable: false, name: "on", flags: { disabled: false } },
    ],
    transitions: [
      {
        id: "widget/machine/flip",
        kind: "transition",
        origin: "own",
        assertable: false,
        name: "flip",
        from: "off",
        to: "on",
        trigger: { kind: "event", name: "click" },
      },
    ],
    guards: [],
    rules: [],
    claims: [
      {
        id: "widget/claims/always-true",
        kind: "invariant",
        origin: "own",
        assertable: true,
        verify: "unit",
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "widget/claims/no-disabled-states",
        kind: "property",
        origin: "own",
        assertable: true,
        verify: "unit",
        ident: "s",
        domain: { kind: "states" },
        predicate: { type: "unop", op: "not", expr: { type: "member", target: { type: "ref", name: "s" }, property: "disabled" } },
      },
      {
        id: "widget/claims/flip-turns-on",
        kind: "scenario",
        origin: "own",
        assertable: true,
        verify: "interaction",
        from: "off",
        events: [{ kind: "event", name: "click" }],
        to: "on",
      },
      {
        id: "widget/claims/feels-nice",
        kind: "unexpressible",
        origin: "own",
        assertable: true,
        claim: "Users say it feels nice to flip.",
      },
    ],
    a11y: [
      {
        id: "widget/a11y/switch-pattern",
        kind: "pattern-conformance",
        origin: "own",
        assertable: true,
        verify: "a11y",
        pattern: "switch",
      },
      {
        id: "widget/a11y/label-delta",
        kind: "delta",
        origin: "own",
        assertable: true,
        verify: "a11y",
        description: "Uses a visually-hidden label instead of aria-label.",
      },
    ],
    style: [],
    composition: [],
    prose: [],
  };
  return component;
}

/**
 * `makeFixture` plus a `FieldNode` and a `DerivedNode`, and a `property`
 * claim whose predicate references the derived value by name — exercises
 * `emitJestTests`' value-graph env construction (`__buildEnv`), not just
 * the plain-props path `makeFixture` alone covers.
 */
export function makeValueGraphFixture(): ComponentNode {
  const component = makeFixture();
  component.declarations = [
    ...component.declarations,
    {
      id: "widget/declarations/name",
      kind: "field",
      origin: "own",
      assertable: false,
      name: "name",
      validate: parseExpr("len(name) > 0"),
    },
    {
      id: "widget/declarations/name-blank",
      kind: "derived",
      origin: "own",
      assertable: false,
      name: "nameBlank",
      valueType: { kind: "bool" },
      expr: parseExpr("not nameValid"),
    },
  ];
  component.claims = [
    ...component.claims,
    {
      id: "widget/claims/name-blank-mirrors-an-empty-name",
      kind: "property",
      origin: "own",
      assertable: true,
      verify: "unit",
      ident: "name",
      domain: { kind: "type", type: { kind: "string" } },
      predicate: parseExpr('nameBlank == (name == "")'),
    },
  ];
  return component;
}

/** `makeFixture` plus two token-ref nodes on different parts, for exercising the style test backend. */
export function makeStyledFixture(): ComponentNode {
  const component = makeFixture();
  component.style = [
    {
      id: "widget/style/root-background",
      kind: "token-ref",
      origin: "own",
      assertable: true,
      part: "root",
      property: "background-color",
      token: "color.surface.default",
    },
    {
      id: "widget/style/root-padding",
      kind: "token-ref",
      origin: "own",
      assertable: true,
      part: "root",
      property: "padding",
      token: "spacing.md",
    },
  ];
  return component;
}
