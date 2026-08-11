import { describe, expect, it } from "vitest";
import { checkScenario, ScenarioCheckError } from "./scenarios.js";
import { computeNodeId } from "./id.js";
import type { ScenarioNode, TransitionNode } from "./nodes.js";

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

const transitions = [toggle];

function makeScenario(overrides: Partial<ScenarioNode> = {}): ScenarioNode {
  return {
    id: computeNodeId("checkbox", "claims", "click-toggles-on"),
    kind: "scenario",
    origin: "own",
    assertable: true,
    verify: "interaction",
    from: "unchecked",
    events: [{ kind: "event", name: "click" }],
    to: "checked",
    ...overrides,
  };
}

describe("checkScenario", () => {
  it("accepts a scenario that traces real transitions to the expected end state", () => {
    expect(() => checkScenario(makeScenario(), transitions)).not.toThrow();
  });

  it("rejects a scenario whose event has no matching transition from the current state", () => {
    const scenario = makeScenario({ events: [{ kind: "event", name: "double-click" }] });
    expect(() => checkScenario(scenario, transitions)).toThrow(ScenarioCheckError);
  });

  it("rejects a scenario that lands somewhere other than the declared end state", () => {
    const scenario = makeScenario({ to: "disabled" });
    expect(() => checkScenario(scenario, transitions)).toThrow(/expected 'disabled'/);
  });

  it("rejects a scenario starting from a state with no outgoing transition at all", () => {
    const scenario = makeScenario({ from: "checked", events: [{ kind: "event", name: "click" }] });
    expect(() => checkScenario(scenario, transitions)).toThrow(ScenarioCheckError);
  });
});
