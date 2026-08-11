import { describe, expect, it } from "vitest";
import type { ComponentNode, PropNode, StateNode } from "loom-ir";
import { machineSeedProp } from "./machine.js";

function makeMachineComponent(props: PropNode[], stateNames: readonly string[]): ComponentNode {
  const states: StateNode[] = stateNames.map((name) => ({
    id: `widget/machine/${name}`,
    kind: "state",
    origin: "own",
    assertable: false,
    name,
    flags: {},
  }));
  return {
    id: "widget",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "widget",
    extends: [],
    declarations: props,
    states,
    transitions: [],
    guards: [],
    rules: [],
    claims: [],
    a11y: [],
    style: [],
    composition: [],
    prose: [],
  };
}

const disabled: PropNode = {
  id: "widget/declarations/disabled",
  kind: "prop",
  origin: "own",
  assertable: false,
  name: "disabled",
  valueType: { kind: "bool" },
  defaultValue: false,
};

describe("machineSeedProp", () => {
  it("returns undefined when no bool prop's name matches a declared state name", () => {
    expect(machineSeedProp(makeMachineComponent([disabled], ["unchecked", "checked"]))).toBeUndefined();
  });

  it("finds the bool prop whose name matches a declared state's name", () => {
    const checkedProp: PropNode = { ...disabled, id: "widget/declarations/checked", name: "checked" };
    const component = makeMachineComponent([disabled, checkedProp], ["unchecked", "checked"]);
    expect(machineSeedProp(component)).toBe(checkedProp);
  });

  it("ignores a non-bool prop even if its name matches a state name", () => {
    const checkedProp: PropNode = {
      id: "widget/declarations/checked",
      kind: "prop",
      origin: "own",
      assertable: false,
      name: "checked",
      valueType: { kind: "string" },
      defaultValue: "",
    };
    const component = makeMachineComponent([disabled, checkedProp], ["unchecked", "checked"]);
    expect(machineSeedProp(component)).toBeUndefined();
  });
});
