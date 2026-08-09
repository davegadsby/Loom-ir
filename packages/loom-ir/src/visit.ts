import type { NodeId } from "./envelope.js";
import type { ComponentNode, LoomNode } from "./nodes.js";

/** Direct children of a node in taxonomy order. Only `ComponentNode` has any. */
export function children(node: LoomNode): LoomNode[] {
  if (node.kind !== "component") return [];
  const c = node as ComponentNode;
  return [
    ...c.declarations,
    ...c.states,
    ...c.transitions,
    ...c.guards,
    ...c.rules,
    ...c.claims,
    ...c.a11y,
    ...c.prose,
  ];
}

export function visit(node: LoomNode, fn: (n: LoomNode) => void): void {
  fn(node);
  for (const child of children(node)) visit(child, fn);
}

export function reduce<T>(node: LoomNode, fn: (acc: T, n: LoomNode) => T, init: T): T {
  let acc = fn(init, node);
  for (const child of children(node)) acc = reduce(child, fn, acc);
  return acc;
}

export function findById(node: LoomNode, id: NodeId): LoomNode | undefined {
  if (node.id === id) return node;
  for (const child of children(node)) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Flattens the whole tree (root included) into a single array, depth-first. */
export function allNodes(root: ComponentNode): LoomNode[] {
  const out: LoomNode[] = [];
  visit(root, (n) => out.push(n));
  return out;
}
