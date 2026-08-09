import type { ComponentNode, LoomNodeEnvelope } from "loom-ir";

function localSlug(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1]!;
}

interface BaseGroup<T> {
  slug: string;
  nodes: T[];
}

/**
 * Merges one taxonomy-group array (e.g. all `declarations`) across a
 * component's bases and its own nodes, by structural slug. A base node not
 * redeclared by the child is carried over — keeping its *original* id, so
 * accumulated results for shared base behaviour stay valid (§5.5) — and
 * stamped as inherited only if it wasn't already (so provenance always
 * points at the ultimate origin, not just the immediate parent). A child
 * node with the same slug as a base node replaces it and is stamped
 * `overridden: true`.
 */
function mergeGroup<T extends LoomNodeEnvelope>(baseGroups: BaseGroup<T>[], ownNodes: T[]): T[] {
  const ownSlugs = new Set(ownNodes.map((n) => localSlug(n.id)));
  const merged: T[] = [];
  const included = new Set<string>();

  for (const { slug: baseSlug, nodes } of baseGroups) {
    for (const node of nodes) {
      const slug = localSlug(node.id);
      if (ownSlugs.has(slug) || included.has(slug)) continue;
      included.add(slug);
      merged.push(
        node.origin === "own" ? ({ ...node, origin: { inheritedFrom: baseSlug, overridden: false } } as T) : node
      );
    }
  }

  for (const node of ownNodes) {
    const slug = localSlug(node.id);
    const overriddenFrom = baseGroups.find(({ nodes }) => nodes.some((n) => localSlug(n.id) === slug));
    merged.push(
      overriddenFrom ? ({ ...node, origin: { inheritedFrom: overriddenFrom.slug, overridden: true } } as T) : node
    );
  }

  return merged;
}

/**
 * Flattens inheritance at parse time, retaining origin in each node's
 * envelope (§5.4/§11.2) — backends see one flat tree while validators and
 * tooling can still report which base a node came from.
 */
export function flattenInheritance(child: ComponentNode, bases: ComponentNode[]): ComponentNode {
  const groups = bases.map((base) => ({ slug: base.id, base }));

  return {
    ...child,
    declarations: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.declarations })),
      child.declarations
    ),
    states: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.states })),
      child.states
    ),
    transitions: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.transitions })),
      child.transitions
    ),
    guards: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.guards })),
      child.guards
    ),
    rules: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.rules })),
      child.rules
    ),
    claims: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.claims })),
      child.claims
    ),
    a11y: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.a11y })),
      child.a11y
    ),
    prose: mergeGroup(
      groups.map(({ slug, base }) => ({ slug, nodes: base.prose })),
      child.prose
    ),
  };
}
