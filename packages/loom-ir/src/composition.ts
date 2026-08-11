import { typecheck, typeEquals, typeToString, type Expr, type LoomType, type TypecheckContext } from "loom-expr";
import type { ComponentNode, DerivedNode, EventNode, FieldNode, OnWireTarget, PropNode, PropValue, ResourceNode, Trigger } from "./nodes.js";

export class CompositionCheckError extends Error {}

/** `LoomValue` includes an index-signature record type, so a plain `"expr" in v` check alone isn't enough for TS to narrow `v.expr` cleanly to `Expr` — an explicit type predicate is. */
function isComputedProp(v: PropValue): v is { expr: Expr } {
  return v !== null && typeof v === "object" && !Array.isArray(v) && "expr" in v;
}

/**
 * Compile-time composition check (mirrors checkScenario in scenarios.ts): a
 * Composition section must describe exactly one tree, rooted at exactly one
 * `root: true` node, with every other node claimed by exactly one ancestor's
 * `slotContent.*.uses`, and every `props`/`slotContent`/`on` key valid
 * against the *referenced* component's own declared props/slots/events.
 * `on` values, `visibleWhen`, and `slotContent.*.fields` are checked against
 * *this* component's own declarations. All of this is checkable purely from
 * data already in memory by parse time (`resolvedComponent` is eagerly
 * resolved), so it's a hard parse error, not a soft validate-time warning —
 * an invalid composition tree must never become a `ComponentNode`.
 *
 * `EventNode.firesWhen` and `FieldNode.validate` are unrelated to
 * composition but are checked here too (over `component.declarations`
 * directly) since they're the same class of "structural reference must
 * resolve"/"must typecheck" check, and run unconditionally (unlike the
 * composition-tree checks) since a component can declare either without
 * having any Composition section at all.
 */
export function checkComposition(component: ComponentNode): void {
  const ownProps = component.declarations.filter((d) => d.kind === "prop");
  const ownPropNames = new Set(ownProps.map((p) => p.name));
  const ownBoolPropNames = new Set(ownProps.filter((p) => p.valueType.kind === "bool").map((p) => p.name));
  const ownEventNames = new Set(component.declarations.filter((d) => d.kind === "event").map((d) => d.name));
  const ownFields = component.declarations.filter((d): d is FieldNode => d.kind === "field");
  const ownFieldNames = new Set(ownFields.map((f) => f.name));
  const ownDerived = component.declarations.filter((d): d is DerivedNode => d.kind === "derived");
  const ownResources = component.declarations.filter((d): d is ResourceNode => d.kind === "resource");

  // Env any component-scoped expression typechecks against: own props, plus each declared
  // field's own current value (string), derived `<name>Valid` boolean, and each declared
  // resource's own value graph type — `list<dataType>`, the same "0-or-1 elements" shape
  // `task-list`'s `tasks` prop already proved end to end (§ Phase 4). Used for a
  // `DerivedNode`'s own `expr` below, and (extended with derived names themselves) for a
  // composed `{ expr }` prop's value further down — but deliberately NOT for `FieldNode.validate`,
  // which stays scoped to only its own field's value (see that check's own context literal).
  const ownValueCtx: TypecheckContext = {
    props: {
      ...Object.fromEntries(ownProps.map((p) => [p.name, p.valueType])),
      ...Object.fromEntries(ownFields.flatMap((f) => [[f.name, { kind: "string" } as LoomType], [`${f.name}Valid`, { kind: "bool" } as LoomType]])),
      ...Object.fromEntries(ownResources.map((r) => [r.name, { kind: "list", of: r.dataType } as LoomType])),
    },
  };

  for (const decl of component.declarations) {
    if (decl.kind === "event" && decl.firesWhen) {
      if (!ownPropNames.has(decl.firesWhen.prop)) {
        throw new CompositionCheckError(
          `event '${decl.id}' has firesWhen.prop '${decl.firesWhen.prop}' which is not a declared prop`
        );
      }
    }
    if (decl.kind === "event" && decl.trigger) {
      const fieldCount = decl.payloadType.kind === "record" ? Object.keys(decl.payloadType.fields).length : 1;
      if (fieldCount > 0) {
        throw new CompositionCheckError(
          `event '${decl.id}' has a trigger but its payloadType is not 'record{}' — a trigger-fired event's payload is always empty`
        );
      }
    }
    if (decl.kind === "field" && decl.validate) {
      let resultType: LoomType;
      try {
        resultType = typecheck(decl.validate, { props: { [decl.name]: { kind: "string" } } });
      } catch (e) {
        throw new CompositionCheckError(`field '${decl.id}' has an invalid validate expression: ${(e as Error).message}`);
      }
      if (resultType.kind !== "bool") {
        throw new CompositionCheckError(
          `field '${decl.id}' validate must evaluate to bool, got '${typeToString(resultType)}'`
        );
      }
    }
    if (decl.kind === "derived") {
      let resultType: LoomType;
      try {
        resultType = typecheck(decl.expr, ownValueCtx);
      } catch (e) {
        throw new CompositionCheckError(`derived '${decl.id}' has an invalid expression: ${(e as Error).message}`);
      }
      if (!typeEquals(resultType, decl.valueType)) {
        throw new CompositionCheckError(
          `derived '${decl.id}' declared type '${typeToString(decl.valueType)}' does not match its expression's type '${typeToString(resultType)}'`
        );
      }
    }
  }

  // Both backends can only bind one `keydown` handler on a root element, so at most one
  // distinct key may be wired across this component's own declared-event triggers —
  // `lowerRootHandlers` groups by (DOM name, key), which would otherwise silently produce
  // two competing `keydown` handlers with no way to print both.
  const keyTriggerKeys = new Set(
    component.declarations
      .filter((d): d is EventNode => d.kind === "event")
      .map((d) => d.trigger)
      .filter((t): t is Extract<Trigger, { kind: "key" }> => t?.kind === "key")
      .map((t) => t.key)
  );
  if (keyTriggerKeys.size > 1) {
    throw new CompositionCheckError(
      `component '${component.id}' declares more than one distinct keyboard trigger key (${[...keyTriggerKeys].join(", ")}) — only one keydown-bound key is supported per component`
    );
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
  // An `each.use` claims its template node exactly the way a `uses` entry claims a child —
  // structurally, it's the same "this name is spoken for by that slot" relationship; the
  // over/as/key semantics are checked later, once we're past pure tree shape.
  const claimedBy = new Map<string, string>(); // childName -> "<parentName>/<slotName>"
  const claim = (childName: string, node: (typeof nodes)[number], slotName: string): void => {
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
  };
  for (const node of nodes) {
    for (const [slotName, content] of Object.entries(node.slotContent ?? {})) {
      if ("uses" in content) {
        for (const childName of content.uses) claim(childName, node, slotName);
      } else if ("each" in content) {
        claim(content.each.use, node, slotName);
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
      else if ("each" in content) stack.push(content.each.use);
    }
  }
  if (visited.size !== nodes.length) {
    throw new CompositionCheckError(`component '${component.id}' has composition nodes unreachable from its root`);
  }

  // Env a `{ expr }` prop value's Expr is typechecked against: everything `ownValueCtx` already
  // covers, plus each of this component's own authored `derived` values by name — letting a
  // composed prop reference a named derived value instead of repeating its expression.
  const exprPropCtx: TypecheckContext = {
    props: {
      ...ownValueCtx.props,
      ...Object.fromEntries(ownDerived.map((d) => [d.name, d.valueType])),
    },
  };

  // Which composition nodes are an `each`'s template, and what bound ident/element type their
  // own `{ expr }` props should see (loom-expr's `typecheck`'s `bound` param, already built for
  // exactly this shadowing case). Built as its own pass — ahead of the per-node loop below, so it
  // doesn't depend on `each.use` being declared after the `each` that references it — and
  // deliberately permissive about a malformed `each.over` here; the real error is thrown by the
  // dedicated `each` validation inside that loop, once per occurrence, with full context.
  const eachTemplateBinding = new Map<string, { as: string; itemType: LoomType }>();
  for (const node of nodes) {
    for (const content of Object.values(node.slotContent ?? {})) {
      if (!("each" in content)) continue;
      const overProp = ownProps.find((p) => p.name === content.each.over);
      if (!overProp || overProp.valueType.kind !== "list") continue;
      eachTemplateBinding.set(content.each.use, { as: content.each.as, itemType: overProp.valueType.of });
    }
  }

  // Cross-reference each node's props/slotContent/on keys against the referenced component's real declarations.
  for (const node of nodes) {
    const referenced = node.resolvedComponent;
    const declaredProps = new Set(referenced.declarations.filter((d) => d.kind === "prop").map((d) => d.name));
    const declaredSlots = new Set(referenced.declarations.filter((d) => d.kind === "slot").map((d) => d.name));
    const declaredEvents = new Set(referenced.declarations.filter((d) => d.kind === "event").map((d) => d.name));
    const binding = eachTemplateBinding.get(node.name);
    const bound = binding ? { [binding.as]: binding.itemType } : {};

    for (const [propName, propValue] of Object.entries(node.props ?? {})) {
      if (!declaredProps.has(propName)) {
        throw new CompositionCheckError(`composition node '${node.id}' sets prop '${propName}' which '${node.component}' does not declare`);
      }
      if (isComputedProp(propValue)) {
        const declaredType = referenced.declarations.find(
          (d): d is PropNode => d.kind === "prop" && d.name === propName
        )!.valueType;
        let exprType: LoomType;
        try {
          exprType = typecheck(propValue.expr, exprPropCtx, bound);
        } catch (e) {
          throw new CompositionCheckError(
            `composition node '${node.id}' prop '${propName}' has an invalid computed expression: ${(e as Error).message}`
          );
        }
        if (!typeEquals(exprType, declaredType)) {
          throw new CompositionCheckError(
            `composition node '${node.id}' prop '${propName}' computed expression has type '${typeToString(exprType)}', expected '${typeToString(declaredType)}'`
          );
        }
      }
    }
    for (const [slotName, content] of Object.entries(node.slotContent ?? {})) {
      if (!declaredSlots.has(slotName)) {
        throw new CompositionCheckError(`composition node '${node.id}' fills slot '${slotName}' which '${node.component}' does not declare`);
      }
      if ("each" in content) {
        // each.use's own resolvability was already checked structurally, alongside `uses`, in the
        // claiming pass above — nothing left to validate here but the semantics `uses` doesn't have.
        const { over, key } = content.each;
        const overProp = ownProps.find((p) => p.name === over);
        if (!overProp) {
          throw new CompositionCheckError(
            `composition node '${node.id}' slot '${slotName}' each.over '${over}' is not a declared prop on '${component.id}'`
          );
        }
        if (overProp.valueType.kind !== "list") {
          throw new CompositionCheckError(
            `composition node '${node.id}' slot '${slotName}' each.over '${over}' must be a list-typed prop, got '${typeToString(overProp.valueType)}'`
          );
        }
        if (key !== undefined) {
          const itemType = overProp.valueType.of;
          if (itemType.kind !== "record" || !(key in itemType.fields)) {
            throw new CompositionCheckError(
              `composition node '${node.id}' slot '${slotName}' each.key '${key}' is not a field of '${over}''s item type ('${typeToString(itemType)}')`
            );
          }
        }
        continue;
      }
      if ("fields" in content) {
        for (const fieldName of content.fields) {
          if (!ownFieldNames.has(fieldName)) {
            throw new CompositionCheckError(
              `composition node '${node.id}' slot '${slotName}' references unknown field '${fieldName}' — not a declared field on '${component.id}'`
            );
          }
        }
      }
    }
    for (const [childEventName, wireRaw] of Object.entries(node.on ?? {})) {
      if (!declaredEvents.has(childEventName)) {
        throw new CompositionCheckError(`composition node '${node.id}' wires event '${childEventName}' which '${node.component}' does not declare`);
      }
      const wires = Array.isArray(wireRaw) ? wireRaw : [wireRaw];
      for (const wireEntry of wires) {
        const target: OnWireTarget = typeof wireEntry === "string" ? { event: wireEntry } : wireEntry;
        if (!ownEventNames.has(target.event)) {
          throw new CompositionCheckError(
            `composition node '${node.id}' wires '${childEventName}' to '${target.event}', which '${component.id}' does not declare`
          );
        }
        const ownEvent = component.declarations.find((d): d is EventNode => d.kind === "event" && d.name === target.event)!;
        const payloadFields = ownEvent.payloadType.kind === "record" ? ownEvent.payloadType.fields : {};
        const payload = target.payload ?? {};
        for (const key of Object.keys(payload)) {
          if (!(key in payloadFields)) {
            throw new CompositionCheckError(
              `composition node '${node.id}' wires '${childEventName}' to '${target.event}' with payload key '${key}' not in '${target.event}''s declared payloadType`
            );
          }
        }
        for (const key of Object.keys(payloadFields)) {
          if (!(key in payload)) {
            throw new CompositionCheckError(
              `composition node '${node.id}' wires '${childEventName}' to '${target.event}' but its payload is missing required field '${key}'`
            );
          }
        }
        for (const source of Object.values(payload)) {
          if (!ownFieldNames.has(source) && !ownPropNames.has(source)) {
            throw new CompositionCheckError(
              `composition node '${node.id}' wires '${childEventName}' payload source '${source}' is neither a declared field nor a declared prop on '${component.id}'`
            );
          }
        }
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
