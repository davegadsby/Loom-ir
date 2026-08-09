import type { ComponentNode } from "loom-ir";

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
    prose: [],
  };
  return component;
}
