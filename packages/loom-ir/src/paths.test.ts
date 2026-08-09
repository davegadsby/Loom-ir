import { describe, expect, it } from "vitest";
import { checkPath, PathCheckError } from "./paths.js";
import { computeNodeId } from "./id.js";
import type { PathNode, TransitionNode } from "./nodes.js";

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

function makePath(overrides: Partial<PathNode> = {}): PathNode {
  return {
    id: computeNodeId("checkbox", "claims", "click-toggles-on"),
    kind: "path",
    origin: "own",
    assertable: true,
    verify: "interaction",
    from: "unchecked",
    events: [{ kind: "event", name: "click" }],
    to: "checked",
    ...overrides,
  };
}

describe("checkPath", () => {
  it("accepts a path that traces real transitions to the expected end state", () => {
    expect(() => checkPath(makePath(), transitions)).not.toThrow();
  });

  it("rejects a path whose event has no matching transition from the current state", () => {
    const path = makePath({ events: [{ kind: "event", name: "double-click" }] });
    expect(() => checkPath(path, transitions)).toThrow(PathCheckError);
  });

  it("rejects a path that lands somewhere other than the declared end state", () => {
    const path = makePath({ to: "disabled" });
    expect(() => checkPath(path, transitions)).toThrow(/expected 'disabled'/);
  });

  it("rejects a path starting from a state with no outgoing transition at all", () => {
    const path = makePath({ from: "checked", events: [{ kind: "event", name: "click" }] });
    expect(() => checkPath(path, transitions)).toThrow(PathCheckError);
  });
});
