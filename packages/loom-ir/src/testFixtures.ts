import { computeNodeId } from "./id.js";
import type { ComponentNode, PropNode, StateNode, TransitionNode, InvariantNode } from "./nodes.js";

/** A minimal checkbox-shaped tree, shared by loom-ir's own tests. */
export function makeCheckboxFixture(): ComponentNode {
  const disabled: PropNode = {
    id: computeNodeId("checkbox", "declarations", "disabled"),
    kind: "prop",
    origin: "own",
    assertable: false,
    name: "disabled",
    valueType: { kind: "bool" },
    defaultValue: false,
  };

  const unchecked: StateNode = {
    id: computeNodeId("checkbox", "machine", "unchecked"),
    kind: "state",
    origin: "own",
    assertable: false,
    name: "unchecked",
    flags: { disabled: false, focusable: true },
  };

  const checked: StateNode = {
    id: computeNodeId("checkbox", "machine", "checked"),
    kind: "state",
    origin: "own",
    assertable: false,
    name: "checked",
    flags: { disabled: false, focusable: true },
  };

  const toggle: TransitionNode = {
    id: computeNodeId("checkbox", "machine", "toggle"),
    kind: "transition",
    origin: "own",
    assertable: false,
    name: "toggle",
    from: "unchecked",
    to: "checked",
    trigger: { kind: "event", name: "click" },
  };

  const invariant: InvariantNode = {
    id: computeNodeId("checkbox", "claims", "disabled-not-focusable"),
    kind: "invariant",
    origin: "own",
    assertable: true,
    verify: "unit",
    predicate: { type: "literal", valueType: { kind: "bool" }, value: true },
  };

  const component: ComponentNode = {
    id: "checkbox",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "checkbox",
    extends: [],
    declarations: [disabled],
    states: [unchecked, checked],
    transitions: [toggle],
    guards: [],
    rules: [],
    claims: [invariant],
    a11y: [],
    style: [],
    prose: [],
  };

  return component;
}
