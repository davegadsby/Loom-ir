import type { ComponentNode, EmittedFile } from "loom-ir";
import { emitJestTests, emitStorybookPlay, emitAxeChecks } from "loom-emit-tests";

export function emitAllTests(component: ComponentNode): EmittedFile[] {
  return [...emitJestTests(component), ...emitStorybookPlay(component), ...emitAxeChecks(component)];
}
