import type { Expr, LoomValue } from "loom-expr";
import type { ComponentNode, FieldNode, OnWireTarget, PropValue, UsesNode } from "./nodes.js";
import type { Attr, Effect, Handler, RenderNode } from "./render.js";

type EmitPayload = Extract<Effect, { kind: "emit" }>["payload"];

/**
 * Lowers a component's own declared slots to a declaration-ordered list of
 * `slot` render nodes — the render-tree replacement for the per-slot loop
 * both emitters used to hand-roll identically.
 *
 * Scoped to components with no root `UsesNode`: `checkbox`, `disclosure`,
 * `button`, `dialog` all lower cleanly through here. A composed component
 * (`confirmation-dialog`, `login-dialog`) is lowered by `lowerComposition`
 * instead — callers still branch on `component.composition` themselves,
 * mirroring the branch both emitters already had before either function
 * existed.
 */
export function lower(component: ComponentNode): RenderNode[] {
  return component.declarations
    .filter((d) => d.kind === "slot")
    .map((slot): RenderNode => ({ kind: "slot", name: slot.name }));
}

/**
 * Lowers a component's own root-element interaction wiring — every
 * machine transition's trigger (dispatching that trigger's own name) and
 * every declared event's own `trigger` (emitting that event with an empty
 * payload) — to `Handler`s, grouped by DOM trigger name (and, for a `key`
 * trigger, by key too) so two things reacting to the exact same trigger
 * (a transition *and* a declared event both wired to `click`, say) print
 * as one handler, not two competing ones on the same attribute.
 *
 * Both a `ComponentNode`'s composed and non-composed root use this — it
 * reads only `declarations`/`transitions`, nothing about the render tree,
 * so it applies uniformly regardless of which lowering path the rest of
 * the component takes.
 *
 * Machine transitions only ever produce a `dispatch` handler for a
 * `kind: "event"` trigger — `LoomMachine`'s own `Transition.matches` still
 * hardcodes `trigger.kind === "event"` as a match requirement (§ Phase 5a),
 * so wiring a machine transition's `key`/`pointer` trigger to a `dispatch`
 * call here would emit code that can never actually match; that's a
 * separate, deeper `loom-expr` gap this doesn't touch. A declared event's
 * own `trigger`, by contrast, doesn't go through the machine at all — it
 * just calls its own callback/emitter directly — so `kind: "key"` is safe
 * to wire there. `kind: "pointer"` stays declarable but produces no
 * handler either way, same as before this function existed.
 */
export function lowerRootHandlers(component: ComponentNode): Handler[] {
  const groups = new Map<string, { on: string; key?: string; effects: Effect[] }>();
  const push = (groupKey: string, on: string, key: string | undefined, effect: Effect): void => {
    const existing = groups.get(groupKey);
    if (existing) existing.effects.push(effect);
    else groups.set(groupKey, { on, key, effects: [effect] });
  };

  const dispatchedTriggerNames = new Set<string>();
  for (const t of component.transitions) {
    if (t.trigger.kind === "event") dispatchedTriggerNames.add(t.trigger.name);
  }
  for (const name of dispatchedTriggerNames) push(name, name, undefined, { kind: "dispatch", event: name });

  for (const decl of component.declarations) {
    if (decl.kind !== "event" || !decl.trigger) continue;
    if (decl.trigger.kind === "event") {
      push(decl.trigger.name, decl.trigger.name, undefined, { kind: "emit", event: decl.name, payload: {} });
    } else if (decl.trigger.kind === "key") {
      push(`keydown:${decl.trigger.key}`, "keydown", decl.trigger.key, { kind: "emit", event: decl.name, payload: {} });
    }
  }

  return [...groups.values()].map(({ on, key, effects }) => (key === undefined ? { on, effects } : { on, key, effects }));
}

/** True if `lowerRootHandlers` produced a `keydown` handler — the root needs `tabIndex`/`tabindex` to ever actually receive it. */
export function hasKeydownHandler(handlers: readonly Handler[]): boolean {
  return handlers.some((h) => h.on === "keydown");
}

function isComputedPropValue(v: PropValue): v is { expr: Expr } {
  return v !== null && typeof v === "object" && !Array.isArray(v) && "expr" in v;
}

/**
 * A literal `PropValue`'s inferred type is never actually consulted by
 * either printer (a literal prints its raw value directly, never through
 * `evaluate()`) — it exists only because `RenderNode`'s `props` field is
 * typed `Record<string, Expr>`, and every `Expr` needs a `valueType`. This
 * mirrors `loom-expr`'s own `inferLiteralType` (bool/number/string only) for
 * consistency, not because anything downstream depends on it being exact.
 */
function literalExpr(value: LoomValue): Expr {
  const valueType =
    typeof value === "boolean"
      ? ({ kind: "bool" } as const)
      : typeof value === "number"
        ? Number.isInteger(value)
          ? ({ kind: "int" } as const)
          : ({ kind: "float" } as const)
        : ({ kind: "string" } as const);
  return { type: "literal", valueType, value };
}

/**
 * Lowers one `FieldNode` to the native input + conditional error message it
 * renders as, wrapped in an `"explicit"` fragment — the render-tree
 * replacement for `renderFieldJsx`/`renderFieldTemplate`. The `<input>`'s
 * dynamic attrs (its current value, its change handler, `aria-invalid`) are
 * deliberately NOT represented here: they reference per-field local state
 * (`usernameValue`/`handleUsernameChange` in React, `username`/
 * `onUsernameInput` in Angular) that is still hand-rolled setup code in both
 * emitters' main function, using naming conventions that differ enough
 * between backends (React's value var carries a `Value` suffix; its change
 * handler is named `handle<Name>Change` vs Angular's `on<Name>Input`) that
 * forcing them through one shared representation here would be premature —
 * each printer special-cases an `<input>` whose `sourceId` names a field it
 * knows about. The `<name>-touched`/`<name>-valid` refs below are printed by
 * `condToJs`, which camelCases them — that's why they're hyphenated here
 * rather than already-camelCased.
 */
function lowerField(field: FieldNode): RenderNode {
  const inputAttrs: Attr[] = [
    { kind: "static", name: "type", value: field.secret ? "password" : "text" },
    { kind: "static", name: "name", value: field.name },
  ];
  const children: RenderNode[] = [
    { kind: "element", tag: "input", attrs: inputAttrs, handlers: [], children: [], sourceId: field.id },
  ];

  if (field.invalidMessage) {
    const cond: Expr = {
      type: "binop",
      op: "and",
      left: { type: "ref", name: `${field.name}-touched` },
      right: { type: "unop", op: "not", expr: { type: "ref", name: `${field.name}-valid` } },
    };
    const errorSpan: RenderNode = {
      kind: "element",
      tag: "span",
      attrs: [{ kind: "static", name: "data-loom-field-error", value: field.name }],
      handlers: [],
      children: [{ kind: "text", value: literalExpr(field.invalidMessage) }],
    };
    children.push({ kind: "when", cond, then: [errorSpan] });
  }

  return { kind: "fragment", children };
}

/**
 * Lowers one `UsesNode.on` map to `Handler`s. Bare-string sugar
 * (`on: { press: "closed" }`) means exactly `{ event: "closed" }` with no
 * `payload` — matching `OnWireTarget`'s own doc comment ("an empty-payload
 * forward"), which is what this always produces now. Angular's printer
 * used to instead forward `$event`; that divergence from the documented
 * meaning is what this unifies away, not a distinction this lowering needs
 * to preserve.
 */
function lowerOnWiring(on: UsesNode["on"]): Handler[] {
  return Object.entries(on ?? {}).map(([childEventName, wireRaw]) => {
    const wires = Array.isArray(wireRaw) ? wireRaw : [wireRaw];
    const effects: Effect[] = wires.map((w) => {
      const target: OnWireTarget = typeof w === "string" ? { event: w } : w;
      const payload: EmitPayload = Object.fromEntries(
        Object.entries(target.payload ?? {}).map(([k, source]): [string, Expr] => [k, { type: "ref", name: source }])
      );
      return { kind: "emit", event: target.event, payload };
    });
    return { on: childEventName, effects };
  });
}

function lowerUsesInstance(
  node: UsesNode,
  byName: ReadonlyMap<string, UsesNode>,
  fieldsByName: ReadonlyMap<string, FieldNode>
): RenderNode {
  const ref = node.resolvedComponent;
  const refSlots = ref.declarations.filter((d) => d.kind === "slot");

  const props: Record<string, Expr> = {};
  for (const [k, v] of Object.entries(node.props ?? {})) {
    props[k] = isComputedPropValue(v) ? v.expr : literalExpr(v);
  }

  const fills: Record<string, RenderNode[]> = {};
  for (const slot of refSlots) {
    const content = node.slotContent?.[slot.name];
    if (!content) continue;
    if ("text" in content) {
      fills[slot.name] = [{ kind: "text", value: literalExpr(content.text) }];
    } else if ("uses" in content) {
      fills[slot.name] = [
        { kind: "fragment", children: content.uses.map((n) => lowerUsesInstance(byName.get(n)!, byName, fieldsByName)) },
      ];
    } else if ("each" in content) {
      const { over, as, use, key } = content.each;
      fills[slot.name] = [
        {
          kind: "each",
          ident: as,
          over: { type: "ref", name: over },
          key: key ? { type: "member", target: { type: "ref", name: as }, property: key } : undefined,
          body: [lowerUsesInstance(byName.get(use)!, byName, fieldsByName)],
        },
      ];
    } else {
      fills[slot.name] = [{ kind: "fragment", children: content.fields.map((n) => lowerField(fieldsByName.get(n)!)) }];
    }
  }

  return { kind: "instance", name: node.name, component: ref, props, fills, handlers: lowerOnWiring(node.on), sourceId: node.id };
}

/**
 * Lowers a component's composition tree, rooted at its one `root: true`
 * `UsesNode`, to a single `RenderNode` — the render-tree replacement for
 * `renderUsesJsx`/`renderUsesTemplate`. `visibleWhen` (root-only) becomes a
 * `when` wrapping the lowered instance; its ref is left hyphen-free (a bare
 * prop name has no synthesized suffix to camelCase away).
 */
export function lowerComposition(rootUses: UsesNode, component: ComponentNode): RenderNode {
  const byName = new Map(component.composition.map((n) => [n.name, n] as const));
  const fields = component.declarations.filter((d): d is FieldNode => d.kind === "field");
  const fieldsByName = new Map(fields.map((f) => [f.name, f] as const));

  const instance = lowerUsesInstance(rootUses, byName, fieldsByName);
  if (!rootUses.visibleWhen) return instance;
  return { kind: "when", cond: { type: "ref", name: rootUses.visibleWhen }, then: [instance] };
}
