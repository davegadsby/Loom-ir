import type { ComponentNode } from "./nodes.js";
import type { RenderNode } from "./render.js";

/**
 * Lowers a component's own declared slots to a declaration-ordered list of
 * `slot` render nodes — the render-tree replacement for the per-slot loop
 * both emitters used to hand-roll identically.
 *
 * Scoped, for now, to components with no root `UsesNode`: `checkbox`,
 * `disclosure`, `button`, `dialog` all lower cleanly through here, but
 * calling this on a composed component (`confirmation-dialog`,
 * `login-dialog`) silently produces the wrong tree — their composition is
 * not yet represented. Callers must still branch on `component.composition`
 * themselves until that lands. `lower()` grows to cover it directly then,
 * at which point this distinction disappears.
 */
export function lower(component: ComponentNode): RenderNode[] {
  return component.declarations
    .filter((d) => d.kind === "slot")
    .map((slot): RenderNode => ({ kind: "slot", name: slot.name }));
}
