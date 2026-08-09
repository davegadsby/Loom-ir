import type { ComponentNode } from "loom-ir";

export function makeFixture(): ComponentNode {
  const component: ComponentNode = {
    id: "checkbox",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "checkbox",
    extends: ["interactive-base"],
    declarations: [],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [
      {
        id: "checkbox/claims/own-invariant",
        kind: "invariant",
        origin: "own",
        assertable: true,
        verify: "unit",
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "interactive-base/claims/disabled-not-focusable",
        kind: "property",
        origin: { inheritedFrom: "interactive-base", overridden: false },
        assertable: true,
        verify: "unit",
        ident: "s",
        domain: { kind: "states" },
        predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
      },
      {
        id: "checkbox/claims/subjective",
        kind: "unexpressible",
        origin: "own",
        assertable: true,
        claim: "Feels nice.",
      },
    ],
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
    prose: [
      { id: "checkbox/prose/intent", kind: "intent", origin: "own", assertable: false, text: "Toggles a boolean choice." },
      { id: "checkbox/prose/rationale", kind: "rationale", origin: "own", assertable: false, text: "Modeled as a two-state machine." },
    ],
  };
  return component;
}
