import type { ComponentNode } from "loom-ir";
import type { DesignTokens } from "loom-tokens";

export function makeFixture(): ComponentNode {
  const component: ComponentNode = {
    id: "widget",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "widget",
    extends: [],
    declarations: [],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [
      {
        id: "widget/claims/emitted-and-passed",
        kind: "invariant",
        origin: "own",
        assertable: true,
        verify: "unit",
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "widget/claims/emitted-not-run",
        kind: "invariant",
        origin: "own",
        assertable: true,
        verify: "unit",
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "widget/claims/no-test-emitted",
        kind: "invariant",
        origin: "own",
        assertable: true,
        verify: "unit",
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "widget/claims/subjective",
        kind: "unexpressible",
        origin: "own",
        assertable: true,
        claim: "Feels nice.",
      },
    ],
    a11y: [],
    style: [],
    prose: [],
  };
  return component;
}

/** `makeFixture` plus a token-ref and a layout-intent with a gapToken, for exercising `checkTokensResolve`. */
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
      id: "widget/style/root-layout",
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

export function makeTokensFixture(): DesignTokens {
  return {
    color: { surface: { default: { $value: "#F5F5F5", $type: "color" } } },
    spacing: { sm: { $value: "4px", $type: "dimension" } },
  };
}
