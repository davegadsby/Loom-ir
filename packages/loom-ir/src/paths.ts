import type { PathNode, TransitionNode, Trigger } from "./nodes.js";

export class PathCheckError extends Error {}

function triggerEquals(a: Trigger, b: Trigger): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "key" && b.kind === "key") return a.key === b.key && a.context === b.context;
  if (a.kind === "event" && b.kind === "event") return a.name === b.name;
  if (a.kind === "pointer" && b.kind === "pointer") return a.name === b.name;
  return false;
}

/**
 * Compile-time path check (§5.2): a scenario traversing an undefined
 * transition is a compile error, not a runtime surprise. Where the machine is
 * authoritative, a PathNode is an assertion *about* the machine, checkable
 * before any test runs.
 */
export function checkPath(path: PathNode, transitions: readonly TransitionNode[]): void {
  let current = path.from;
  path.events.forEach((event, i) => {
    const hop = transitions.find((t) => t.from === current && triggerEquals(t.trigger, event));
    if (!hop) {
      throw new PathCheckError(
        `path '${path.id}' has no transition out of state '${current}' matching event #${i} (${JSON.stringify(event)})`
      );
    }
    current = hop.to;
  });
  if (current !== path.to) {
    throw new PathCheckError(`path '${path.id}' ends in state '${current}', expected '${path.to}'`);
  }
}
