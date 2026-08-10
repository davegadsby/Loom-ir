import type { ComponentNode } from "loom-ir";

function stateLiteral(state: ComponentNode["states"][number]): string {
  return JSON.stringify({ id: state.name, ...state.flags });
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
