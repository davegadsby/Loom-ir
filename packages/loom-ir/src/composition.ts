import type { ComponentNode } from "./nodes.js";

export class CompositionCheckError extends Error {}

/**
 * Compile-time composition check (mirrors checkPath in paths.ts): a
 * Composition section must describe exactly one tree, rooted at exactly one
 * `root: true` node, with every other node claimed by exactly one ancestor's
 * `slotContent.*.uses`, and every `props`/`slotContent`/`on` key valid
 * against the *referenced* component's own declared props/slots/events.
 * `on` values and `visibleWhen` are checked against *this* component's own
 * declarations. All of this is checkable purely from data already in memory
 * by parse time (`resolvedComponent` is eagerly resolved), so it's a hard
 * parse error, not a soft validate-time warning — an invalid composition
 * tree must never become a `ComponentNode`.
 *
 * `EventNode.firesWhen` is unrelated to composition but is checked here too
 * (over `component.declarations` directly) since it's the same class of
 * "structural reference must resolve" check, and runs unconditionally
 * (unlike the composition-tree checks) since a component can declare
 * `firesWhen` without having any Composition section at all.
 */
export function checkComposition(component: ComponentNode): void {
  const ownProps = component.declarations.filter((d) => d.kind === "prop");
  const ownPropNames = new Set(ownProps.map((p) => p.name));
  const ownBoolPropNames = new Set(ownProps.filter((p) => p.valueType.kind === "bool").map((p) => p.name));
  const ownEventNames = new Set(component.declarations.filter((d) => d.kind === "event").map((d) => d.name));

  for (const decl of component.declarations) {
    if (decl.kind === "event" && decl.firesWhen) {
      if (!ownPropNames.has(decl.firesWhen.prop)) {
        throw new CompositionCheckError(
          `event '${decl.id}' has firesWhen.prop '${decl.firesWhen.prop}' which is not a declared prop`
        );
      }
    }
  }

  const nodes = component.composition;
  if (nodes.length === 0) return;

  const roots = nodes.filter((n) => n.root === true);
  if (roots.length !== 1) {
    throw new CompositionCheckError(
      `component '${component.id}' has ${roots.length} root composition nodes (expected exactly 1)`
    );
  }
  const root = roots[0]!;

  const byName = new Map(nodes.map((n) => [n.name, n] as const));
  if (byName.size !== nodes.length) {
    throw new CompositionCheckError(`component '${component.id}' has duplicate composition node names`);
  }

  // Every reference to a sibling name must resolve, and be claimed by at most one parent.
  const claimedBy = new Map<string, string>(); // childName -> "<parentName>/<slotName>"
  for (const node of nodes) {
    for (const [slotName, content] of Object.entries(node.slotContent ?? {})) {
      if (!("uses" in content)) continue;
      for (const childName of content.uses) {
        if (!byName.has(childName)) {
          throw new CompositionCheckError(
            `composition node '${node.id}' slot '${slotName}' references unknown composition node '${childName}'`
          );
        }
        if (claimedBy.has(childName)) {
          throw new CompositionCheckError(
            `composition node '${childName}' is claimed by more than one parent slot ('${claimedBy.get(childName)}' and '${node.name}/${slotName}')`
          );
        }
        claimedBy.set(childName, `${node.name}/${slotName}`);
      }
    }
  }
  if (claimedBy.has(root.name)) {
    throw new CompositionCheckError(`root composition node '${root.name}' cannot also be referenced by another node's slotContent`);
  }
  for (const node of nodes) {
    if (node.name !== root.name && !claimedBy.has(node.name)) {
      throw new CompositionCheckError(`composition node '${node.id}' is orphaned — not the root and not referenced by any slotContent`);
    }
  }

  // Tree-shape check via DFS from root — catches cycles and duplicate visits in one pass.
  const visited = new Set<string>();
  const stack = [root.name];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) {
      throw new CompositionCheckError(`composition graph rooted at '${root.name}' is not a tree — '${current}' is reachable more than once`);
    }
    visited.add(current);
    for (const content of Object.values(byName.get(current)!.slotContent ?? {})) {
      if ("uses" in content) stack.push(...content.uses);
    }
  }
  if (visited.size !== nodes.length) {
    throw new CompositionCheckError(`component '${component.id}' has composition nodes unreachable from its root`);
  }

  // Cross-reference each node's props/slotContent/on keys against the referenced component's real declarations.
  for (const node of nodes) {
    const referenced = node.resolvedComponent;
    const declaredProps = new Set(referenced.declarations.filter((d) => d.kind === "prop").map((d) => d.name));
    const declaredSlots = new Set(referenced.declarations.filter((d) => d.kind === "slot").map((d) => d.name));
    const declaredEvents = new Set(referenced.declarations.filter((d) => d.kind === "event").map((d) => d.name));

    for (const propName of Object.keys(node.props ?? {})) {
      if (!declaredProps.has(propName)) {
        throw new CompositionCheckError(`composition node '${node.id}' sets prop '${propName}' which '${node.component}' does not declare`);
      }
    }
    for (const slotName of Object.keys(node.slotContent ?? {})) {
      if (!declaredSlots.has(slotName)) {
        throw new CompositionCheckError(`composition node '${node.id}' fills slot '${slotName}' which '${node.component}' does not declare`);
      }
    }
    for (const [childEventName, ownEventName] of Object.entries(node.on ?? {})) {
      if (!declaredEvents.has(childEventName)) {
        throw new CompositionCheckError(`composition node '${node.id}' wires event '${childEventName}' which '${node.component}' does not declare`);
      }
      if (!ownEventNames.has(ownEventName)) {
        throw new CompositionCheckError(
          `composition node '${node.id}' wires '${childEventName}' to '${ownEventName}', which '${component.id}' does not declare`
        );
      }
    }
    if (node.visibleWhen !== undefined) {
      if (node.name !== root.name) {
        throw new CompositionCheckError(`composition node '${node.id}' sets visibleWhen but is not the root node`);
      }
      if (!ownBoolPropNames.has(node.visibleWhen)) {
        throw new CompositionCheckError(
          `composition node '${node.id}' has visibleWhen '${node.visibleWhen}' which is not a declared bool prop on '${component.id}'`
        );
      }
    }
  }
}

