import type { ComponentNode, EmittedFile } from "loom-ir";
import { emitJestTests, emitAxeChecks, emitTokenConformanceTests } from "loom-emit-tests";

/**
 * `emitStorybookPlay` is deliberately NOT part of this bundle — a story's
 * `import { X } from "./X"` only resolves relatively as a sibling of the
 * compiled component it drives, so its output is written directly into
 * `generated/react/` (see `examples/regenerate.ts`), not this generic
 * output directory every other test backend shares.
 */
export function emitAllTests(component: ComponentNode): EmittedFile[] {
  return [...emitJestTests(component), ...emitAxeChecks(component), ...emitTokenConformanceTests(component)];
}
