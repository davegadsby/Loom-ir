import type { NodeId } from "./envelope.js";

/** The four taxonomy groups a node's structural path can sit under (§5.3), plus the root's own declarations bucket. */
export type SectionKind = "declarations" | "machine" | "claims" | "a11y" | "prose";

const SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Structural node identity (§5.5): component + section + node path, never
 * derived from prose. Rewording the text under a heading must never change
 * this — that's what keeps accumulated test results from being orphaned.
 */
export function computeNodeId(componentSlug: string, section: SectionKind, nodeSlug: string): NodeId {
  if (!SLUG_PATTERN.test(componentSlug)) {
    throw new Error(`invalid component slug '${componentSlug}': must be lowercase kebab-case`);
  }
  if (!SLUG_PATTERN.test(nodeSlug)) {
    throw new Error(`invalid node slug '${nodeSlug}': must be lowercase kebab-case`);
  }
  return `${componentSlug}/${section}/${nodeSlug}`;
}
