import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSpec } from "loom-parser";
import type { ComponentNode } from "loom-ir";

/** Resolves `extends` refs to sibling `<ref>.md` files next to the spec being compiled, recursively. */
export function makeFileResolveBase(specDir: string): (ref: string) => ComponentNode {
  const cache = new Map<string, ComponentNode>();
  const resolve = (ref: string): ComponentNode => {
    const cached = cache.get(ref);
    if (cached) return cached;
    const path = join(specDir, `${ref}.md`);
    const source = readFileSync(path, "utf8");
    const parsed = parseSpec(source, { resolveBase: resolve });
    cache.set(ref, parsed);
    return parsed;
  };
  return resolve;
}

export function loadComponent(specPath: string): ComponentNode {
  const source = readFileSync(specPath, "utf8");
  return parseSpec(source, { resolveBase: makeFileResolveBase(dirname(specPath)) });
}
