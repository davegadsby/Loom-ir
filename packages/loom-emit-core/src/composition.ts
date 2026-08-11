import type { ComponentNode, UsesNode } from "loom-ir";

export function isComputedPropValue(v: unknown): v is { expr: unknown } {
  return v !== null && typeof v === "object" && !Array.isArray(v) && "expr" in v;
}

/** Every distinct component reached by a composition tree, sorted for deterministic import ordering. */
export function collectReferencedComponents(nodes: readonly UsesNode[]): ComponentNode[] {
  const seen = new Map<string, ComponentNode>();
  for (const node of nodes) {
    if (!seen.has(node.resolvedComponent.name)) seen.set(node.resolvedComponent.name, node.resolvedComponent);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
