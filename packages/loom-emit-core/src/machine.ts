import type { ComponentNode, PropNode } from "loom-ir";

function stateLiteral(state: ComponentNode["states"][number]): string {
  return JSON.stringify({ id: state.name, ...state.flags });
}

/**
 * Finds the one declared bool prop, if any, whose name exactly matches a
 * declared state's own name — the only structural link this taxonomy has
 * between "a prop that represents current state" and "which state that
 * is" (there's no dedicated IR field for it; `checked`/`checkbox.md` and
 * `expanded`/`disclosure.md` both happen to name their state-mirroring
 * prop after one of the two states it can be). Used to seed a machine's
 * initial `state` from that prop instead of always starting at
 * `__machine.initialState` (the first-declared state), which previously
 * silently ignored the prop entirely: a controlled native checkbox
 * rendered `checked={true}` would still start visually unchecked. Returns
 * `undefined` for a machine-backed component with no such prop.
 */
export function machineSeedProp(component: ComponentNode): PropNode | undefined {
  const stateNames = new Set(component.states.map((s) => s.name));
  return component.declarations.find(
    (d): d is PropNode => d.kind === "prop" && d.valueType.kind === "bool" && stateNames.has(d.name)
  );
}

/**
 * One `new Transition({...})` call, guard included as `Guard.from(expr)` —
 * states are plain data (no behavior to encapsulate), but a transition's
 * matching logic and a guard's evaluation are exactly what these classes
 * exist to own, so they're instantiated explicitly rather than left as
 * anonymous nested object literals.
 */
function transitionLines(transition: ComponentNode["transitions"][number], indent: string): string[] {
  const lines = [
    `${indent}new Transition({`,
    `${indent}  id: ${JSON.stringify(transition.name)},`,
    `${indent}  from: ${JSON.stringify(transition.from)},`,
    `${indent}  to: ${JSON.stringify(transition.to)},`,
    `${indent}  trigger: ${JSON.stringify(transition.trigger)},`,
  ];
  if (transition.guard) lines.push(`${indent}  guard: Guard.from(${JSON.stringify(transition.guard)}),`);
  lines.push(`${indent}}),`);
  return lines;
}

/** `const __machine = new LoomMachine({ ... })`, formatted as readable multi-line source rather than one JSON line. */
export function machineLines(component: ComponentNode): string[] {
  const lines: string[] = [`const __machine = new LoomMachine({`, `  states: [`];
  for (const state of component.states) lines.push(`    ${stateLiteral(state)},`);
  lines.push(`  ],`, `  transitions: [`);
  for (const transition of component.transitions) lines.push(...transitionLines(transition, "    "));
  lines.push(`  ],`, `});`, ``);
  return lines;
}
