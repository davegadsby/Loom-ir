import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSpec } from "loom-parser";
import type { ComponentNode } from "loom-ir";

/**
 * Resolves both `extends` and `uses` refs to sibling `<ref>.md` files next to
 * the spec being compiled, recursively, with a shared cache — the same
 * underlying resolver wired to both `parseSpec` options, since both mean
 * "load and fully parse this sibling spec"; `parseSpec` itself is what keeps
 * `extends` (flattened) and `uses` (embedded whole) semantically distinct.
 * Guards against a spec `extends`/`uses`-referencing itself, directly or
 * transitively, with a clear error instead of a stack overflow.
 */
export function makeFileResolveBase(specDir: string): (ref: string) => ComponentNode {
  const cache = new Map<string, ComponentNode>();
  const inProgress = new Set<string>();
  const resolve = (ref: string): ComponentNode => {
    const cached = cache.get(ref);
    if (cached) return cached;
    if (inProgress.has(ref)) {
      throw new Error(`circular spec reference detected while resolving '${ref}' (extends/uses cycle)`);
    }
    inProgress.add(ref);
    try {
      const path = join(specDir, `${ref}.md`);
      const source = readFileSync(path, "utf8");
      const parsed = parseSpec(source, { resolveBase: resolve, resolveComponent: resolve });
      cache.set(ref, parsed);
      return parsed;
    } finally {
      inProgress.delete(ref);
    }
  };
  return resolve;
}

export function loadComponent(specPath: string): ComponentNode {
  const source = readFileSync(specPath, "utf8");
  const resolve = makeFileResolveBase(dirname(specPath));
  return parseSpec(source, { resolveBase: resolve, resolveComponent: resolve });
}
