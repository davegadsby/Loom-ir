import type { ComponentNode, DerivedNode, EmittedFile, FieldNode, Handler, PropNode, ResourceNode, RenderNode } from "loom-ir";
import { lower, lowerComposition, lowerRootHandlers, hasKeydownHandler } from "loom-ir";
import type { Expr } from "loom-expr";
import { partClassName } from "loom-emit-styles";
import {
  capitalize,
  camelCase,
  collectReferencedComponents,
  compileExprToJs,
  condToJs,
  loomTypeToTs,
  machineLines,
  machineSeedProp,
  pascalCase,
  type RefResolver,
} from "loom-emit-core";

/**
 * Resolves a declared prop/resource/field(Valid)/derived name to the JS
 * local variable that currently holds it — the replacement for building an
 * env object literal and calling `evaluate(exprJson, env)` against it.
 * `boundIdents` (an `each`'s own loop variable(s), innermost last) resolve
 * to themselves — already in scope as an ordinary closure parameter by the
 * time a template instance's `{expr}` prop references one, no different
 * from a destructured prop.
 */
function buildRefResolver(
  props: readonly PropNode[],
  fields: readonly FieldNode[],
  resources: readonly ResourceNode[] = [],
  derivedValues: readonly DerivedNode[] = [],
  boundIdents: readonly string[] = []
): RefResolver {
  const map = new Map<string, string>();
  for (const p of props) map.set(p.name, p.name);
  for (const r of resources) map.set(r.name, r.name);
  for (const f of fields) {
    const c = camelCase(f.name);
    map.set(f.name, `${c}Value`);
    map.set(`${f.name}Valid`, `${c}Valid`);
  }
  for (const d of derivedValues) map.set(d.name, camelCase(d.name));
  for (const b of boundIdents) map.set(b, b);
  return (name) => {
    const resolved = map.get(name);
    if (resolved === undefined) throw new Error(`emitReact: unresolved reference '${name}' while compiling an expression`);
    return resolved;
  };
}

/** The default slot maps to React's built-in `children`; every other slot becomes its own named prop. */
function slotPropName(slotName: string): string {
  return slotName === "default" ? "children" : camelCase(slotName);
}

/**
 * Prints the render tree `lower()` produces for the non-composition path.
 * Only `slot` is exercised yet (Phase 1b); every other `RenderNode` kind
 * throws rather than silently rendering nothing, since a component that
 * needs one isn't supposed to reach this printer until a later phase adds
 * support for it.
 */
function printRenderNodes(nodes: readonly RenderNode[], componentSlug: string, styledParts: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind !== "slot") throw new Error(`printRenderNodes: unsupported render node kind '${node.kind}'`);
    if (node.name === "default") {
      out.push(`      {children}`);
    } else {
      const classAttr = styledParts.has(node.name)
        ? ` className=${JSON.stringify(partClassName(componentSlug, node.name))}`
        : "";
      out.push(`      <div data-loom-slot=${JSON.stringify(node.name)}${classAttr}>{${slotPropName(node.name)}}</div>`);
    }
  }
  return out;
}

/**
 * `over`/`key` on an `each` node are always a plain `ref`/`member` chain by
 * construction (`lower.ts` only ever builds them that way) — already-scoped
 * JS values (a destructured prop, an `each`'s own callback parameter), never
 * something needing a runtime `evaluate()` call.
 */
function printBareRef(expr: Expr): string {
  if (expr.type === "ref") return expr.name;
  if (expr.type === "member") return `${printBareRef(expr.target)}.${expr.property}`;
  throw new Error(`printBareRef: unsupported expr type '${expr.type}'`);
}

/**
 * A literal prop prints its raw value directly; anything else is a computed
 * `{expr}` prop, compiled straight to JS against `resolveRef` — `boundIdents`
 * (any `each` idents currently in scope) resolve to themselves, so a
 * template instance nested inside `tasks.map((task) => ...)` can reference
 * `task` from its own `{expr}` props. No `=== true`/`as T` coercion needed
 * anymore: `compileExprToJs`'s output is genuine typed JS (a boolean-shaped
 * expr already type-checks as `boolean`), not an `any`-typed interpreter
 * result that needed forcing into TS's type system after the fact.
 */
function printPropExpr(expr: Expr, resolveRef: RefResolver, boundIdents: readonly string[]): string {
  if (expr.type === "literal") return JSON.stringify(expr.value);
  const withBound: RefResolver = (name) => (boundIdents.includes(name) ? name : resolveRef(name));
  return compileExprToJs(expr, withBound);
}

/**
 * A field-sourced payload value carries a `Value` suffix (React's field
 * state variable is named `<name>Value`); a prop-sourced one prints as-is.
 */
function printEmitEffect(effect: Extract<Handler["effects"][number], { kind: "emit" }>, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  const payloadEntries = Object.entries(effect.payload).map(([k, expr]) => {
    const source = (expr as Extract<Expr, { type: "ref" }>).name;
    return `${k}: ${fieldsByName.has(source) ? `${camelCase(source)}Value` : source}`;
  });
  return `on${capitalize(effect.event)}?.({ ${payloadEntries.join(", ")} });`;
}

/**
 * `dispatch` calls the same root-scoped `const dispatch = ...` closure
 * `emitReact`'s main function defines whenever the component has a
 * machine — always in scope by the time a `dispatch` effect can exist,
 * since `lowerRootHandlers` only ever produces one from an actual
 * `TransitionNode.trigger`.
 */
function printEffect(effect: Handler["effects"][number], fieldsByName: ReadonlyMap<string, FieldNode>): string {
  if (effect.kind === "dispatch") return `dispatch(${JSON.stringify(effect.event)});`;
  if (effect.kind !== "emit") throw new Error(`printEffect: unsupported effect kind '${effect.kind}'`);
  return printEmitEffect(effect, fieldsByName);
}

/** React's synthetic event props are camelCase; a multi-word native DOM event name (only `"keydown"` so far) doesn't camelCase by capitalizing alone. */
function reactEventPropName(domEventName: string): string {
  return domEventName === "keydown" ? "keyDown" : domEventName;
}

function printHandlers(handlers: readonly Handler[], fieldsByName: ReadonlyMap<string, FieldNode>): string[] {
  return handlers.map((h) => {
    const calls = h.effects.map((e) => printEffect(e, fieldsByName));
    const propName = `on${capitalize(reactEventPropName(h.on))}`;
    if (h.key !== undefined) {
      return `${propName}={(e) => { if (e.key === ${JSON.stringify(h.key)}) { ${calls.join(" ")} } }}`;
    }
    return `${propName}={() => { ${calls.join(" ")} }}`;
  });
}

/**
 * A `text`/`each` node needs `{}` braces only when it appears as a JSX
 * element child (a bare JS string/expression isn't valid JSX text) — as an
 * attribute value or inside a fragment, the caller already supplies the one
 * wrapping `{}` an attribute needs. Every other kind already prints valid
 * JSX on its own.
 */
function printElementChild(
  node: RenderNode,
  fieldsByName: ReadonlyMap<string, FieldNode>,
  resolveRef: RefResolver,
  boundIdents: readonly string[]
): string {
  return node.kind === "text" || node.kind === "each"
    ? `{${printInline(node, fieldsByName, resolveRef, boundIdents)}}`
    : printInline(node, fieldsByName, resolveRef, boundIdents);
}

/**
 * Prints one lowered composition subtree as a flat JSX expression string —
 * no internal newlines; only the composed root's `visibleWhen` wrap (handled
 * by its caller in `emitReact`) is ever multi-line. `slot` doesn't appear in
 * a composition tree (Phase 1b's path is a distinct, non-composed one), so
 * it isn't handled here.
 *
 * `resolveRef` is the component's base ref resolver (props/fields/resources/
 * derived), built once by `emitReact`'s main function. `boundIdents` names
 * every `each` ident currently in scope, innermost last — threaded down so a
 * prop's `{expr}` (via `printPropExpr`) knows to resolve them to themselves
 * rather than through `resolveRef`. `leadingAttrs` exists for exactly one
 * caller, `each`'s own case below: injecting `key={...}` as the first JSX
 * attribute on its single templated child, the same "extra attrs from the
 * caller" shape `printElement`'s Angular counterpart already uses for
 * `*ngIf`/`*ngFor`.
 */
function printInline(
  node: RenderNode,
  fieldsByName: ReadonlyMap<string, FieldNode>,
  resolveRef: RefResolver,
  boundIdents: readonly string[] = [],
  leadingAttrs: readonly string[] = []
): string {
  switch (node.kind) {
    case "text":
      return JSON.stringify((node.value as Extract<Expr, { type: "literal" }>).value);
    case "fragment": {
      const inner = node.children.map((c) => printInline(c, fieldsByName, resolveRef, boundIdents)).join("");
      return `<>${inner}</>`;
    }
    case "when": {
      const cond = condToJs(node.cond);
      const inner = node.then.map((c) => printInline(c, fieldsByName, resolveRef, boundIdents)).join("");
      return `{${cond} && ${inner}}`;
    }
    case "each": {
      const source = printBareRef(node.over);
      const keyAttrs = node.key ? [`key={${printBareRef(node.key)}}`] : [];
      const body = node.body
        .map((c) => printInline(c, fieldsByName, resolveRef, [...boundIdents, node.ident], keyAttrs))
        .join("");
      return `${source}.map((${node.ident}) => (${body}))`;
    }
    case "element": {
      const staticAttrs = node.attrs.map((a) => {
        if (a.kind !== "static") throw new Error(`printInline: unsupported attr kind '${a.kind}'`);
        return `${a.name}=${JSON.stringify(a.value)}`;
      });
      let dynamicAttrs: string[] = [];
      if (node.tag === "input") {
        const nameAttr = node.attrs.find((a) => a.kind === "static" && a.name === "name");
        const camel = camelCase((nameAttr as Extract<typeof nameAttr, { kind: "static" }>).value);
        const Camel = capitalize(camel);
        dynamicAttrs = [`value={${camel}Value}`, `onChange={handle${Camel}Change}`, `aria-invalid={${camel}Touched && !${camel}Valid}`];
      }
      const attrsStr = [...leadingAttrs, ...staticAttrs, ...dynamicAttrs].join(" ");
      if (node.children.length === 0) return `<${node.tag} ${attrsStr} />`;
      const inner = node.children.map((c) => printElementChild(c, fieldsByName, resolveRef, boundIdents)).join("");
      return `<${node.tag} ${attrsStr}>${inner}</${node.tag}>`;
    }
    case "instance": {
      const refName = pascalCase(node.component.name);
      const refSlots = node.component.declarations.filter((d) => d.kind === "slot");

      const propAttrs = Object.entries(node.props).map(
        ([k, expr]) => `${k}={${printPropExpr(expr, resolveRef, boundIdents)}}`
      );

      const namedSlotAttrs: string[] = [];
      let defaultChildrenExpr: string | undefined;
      for (const slot of refSlots) {
        const fillNodes = node.fills[slot.name];
        if (!fillNodes) continue;
        const rendered = fillNodes.map((n) => printInline(n, fieldsByName, resolveRef, boundIdents)).join("");
        if (slot.name === "default") defaultChildrenExpr = rendered;
        else namedSlotAttrs.push(`${slotPropName(slot.name)}={${rendered}}`);
      }

      const onAttrs = printHandlers(node.handlers, fieldsByName);

      const attrs = [...leadingAttrs, ...propAttrs, ...namedSlotAttrs, ...onAttrs];
      const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
      return defaultChildrenExpr !== undefined
        ? `<${refName}${attrsStr}>{${defaultChildrenExpr}}</${refName}>`
        : `<${refName}${attrsStr} />`;
    }
    default:
      throw new Error(`printInline: unsupported render node kind '${node.kind}'`);
  }
}

/**
 * Compiles a `ComponentNode` to a minimal React function component (§4/§14
 * step 5 — the first framework target).
 *
 * Declarations become a typed props interface. A `SlotNode` named
 * `"default"` maps to React's built-in `children`; any other slot becomes
 * its own `React.ReactNode` prop. If the component has a machine, it's
 * instantiated at runtime as a loom-expr `LoomMachine` — the same
 * interpreter loom-emit-tests reuses for generated tests, now wrapped in a
 * typed class instead of an untyped literal — rather than transpiling each
 * guard into bespoke JS. Root-level interaction wiring (`lowerRootHandlers`)
 * only ever produces a `{kind:"event"}`-triggered handler today (key/pointer
 * triggers stay declarable but inert); `MethodNode`s have no React rendering
 * strategy yet and are skipped rather than failing the whole emission
 * (§14 step 5's "skip, don't throw" contract). The root element is a real
 * `<button type="button">` when the component's `pattern-conformance` names
 * the `"button"` pattern — `disabled` becomes the native attribute instead
 * of `aria-disabled` (the browser refuses to fire `click` on a disabled
 * `<button>` at all, which `aria-disabled` alone never did — nothing
 * guarded a click handler against a disabled prop before this), and Enter/
 * Space activation comes free from the browser instead of needing a
 * hand-wired keyboard trigger. Every other pattern still renders `<div
 * role="...">`. If any `part`
 * (root or a slot) carries a `TokenRefNode`/`LayoutIntentNode`, its DOM node
 * gets a `className` from `loom-emit-styles`' `partClassName` — the same
 * naming function the CSS backend uses to generate the matching selector —
 * and the file imports the sibling `<Component>.css` loom-emit-styles emits.
 *
 * If the component has a `Composition` section (§ compound components), the
 * root `UsesNode` is recursively rendered inside the wrapper `<div>` instead
 * of the per-slot loop, with an `import` per distinct referenced component.
 * `EventNode.firesWhen` gets a `useRef`/`useEffect` pair that fires the
 * corresponding callback prop when the watched prop transitions to the
 * target value (never on mount).
 */
export function emitReact(component: ComponentNode): EmittedFile[] {
  const componentName = pascalCase(component.name);
  const unsupported = component.declarations.filter((d) => d.kind === "method");
  for (const node of unsupported) {
    // eslint-disable-next-line no-console
    console.warn(`[loom-emit-react] '${node.id}' (kind: method) is unsupported by this backend; skipped.`);
  }

  const props = component.declarations.filter((d) => d.kind === "prop");
  const events = component.declarations.filter((d) => d.kind === "event");
  const slots = component.declarations.filter((d) => d.kind === "slot");
  const resources = component.declarations.filter((d): d is ResourceNode => d.kind === "resource");
  const pattern = component.a11y.find((n) => n.kind === "pattern-conformance");
  const disabledProp = props.find((p) => p.name === "disabled");
  // `VisualConformanceNode` carries no CSS (§ Style scope), so it doesn't count toward "this part is styled."
  const styledParts = new Set(component.style.filter((n) => n.kind !== "visual-conformance").map((n) => n.part));
  const rootUses = component.composition.find((n) => n.root);
  const referencedComponents = collectReferencedComponents(component.composition);
  const fields = component.declarations.filter((d): d is FieldNode => d.kind === "field");
  const fieldsByName = new Map(fields.map((f) => [f.name, f] as const));
  const derivedValues = component.declarations.filter((d): d is DerivedNode => d.kind === "derived");

  const lines: string[] = [
    `// GENERATED by loom-emit-react. Do not edit by hand.`,
    unsupported.length > 0
      ? `// Unsupported by this backend: ${unsupported.map((n) => n.id).join(", ")}`
      : undefined,
    `import * as React from "react";`,
    component.transitions.length > 0 ? `import { LoomMachine, Transition, Guard } from "loom-expr";` : undefined,
    styledParts.size > 0 ? `import "./${componentName}.css";` : undefined,
    ...referencedComponents.map((c) => `import { ${pascalCase(c.name)} } from "./${pascalCase(c.name)}";`),
    ``,
  ].filter((l): l is string => l !== undefined);

  if (component.transitions.length > 0) {
    lines.push(...machineLines(component));
  }

  lines.push(`export interface ${componentName}Props {`);
  for (const prop of props) {
    lines.push(`  /** ${prop.id} */`);
    lines.push(`  ${prop.name}?: ${loomTypeToTs(prop.valueType)};`);
  }
  for (const resource of resources) {
    lines.push(`  /** ${resource.id} */`);
    lines.push(`  ${resource.name}?: Array<${loomTypeToTs(resource.dataType)}>;`);
  }
  for (const event of events) {
    lines.push(`  /** ${event.id} */`);
    lines.push(`  on${capitalize(event.name)}?: (payload: ${loomTypeToTs(event.payloadType)}) => void;`);
  }
  for (const slot of slots) {
    lines.push(`  /** ${slot.id} */`);
    lines.push(`  ${slotPropName(slot.name)}?: React.ReactNode;`);
  }
  lines.push(`}`, ``);

  lines.push(`export function ${componentName}(props: ${componentName}Props): React.ReactElement {`);
  const destructured = props.map((p) => `${p.name} = ${JSON.stringify(p.defaultValue ?? null)}`);
  const resourceDestructured = resources.map((r) => `${r.name} = []`);
  const eventCallbackNames = events.map((e) => `on${capitalize(e.name)}`);
  if (destructured.length > 0 || resourceDestructured.length > 0 || slots.length > 0 || eventCallbackNames.length > 0) {
    const parts = [...destructured, ...resourceDestructured, ...slots.map((s) => slotPropName(s.name)), ...eventCallbackNames];
    lines.push(`  const { ${parts.join(", ")} } = props;`);
  }

  for (const field of fields) {
    const camel = camelCase(field.name);
    const Camel = capitalize(camel);
    lines.push(`  const [${camel}Value, set${Camel}Value] = React.useState<string>(${JSON.stringify(field.initialValue ?? "")});`);
    lines.push(`  const [${camel}Touched, set${Camel}Touched] = React.useState<boolean>(false);`);
    const validExpr = field.validate
      ? compileExprToJs(field.validate, (name) => {
          if (name !== field.name) {
            throw new Error(`emitReact: field '${field.id}' validate references unresolved name '${name}'`);
          }
          return `${camel}Value`;
        })
      : `true`;
    lines.push(`  const ${camel}Valid = ${validExpr};`);
    lines.push(`  const handle${Camel}Change = (e: React.ChangeEvent<HTMLInputElement>) => {`);
    lines.push(`    set${Camel}Value(e.target.value);`);
    lines.push(`    set${Camel}Touched(true);`);
    lines.push(`  };`);
  }
  if (fields.length > 0) lines.push(``);

  // A derived value's own expr is checked (composition.ts) against only this component's own
  // props/fields — never another derived value — so it resolves against a narrower resolver
  // than a composed prop's, the same convention FieldNode.validate already uses. Only `bool` is
  // supported for now; nothing yet needs another valueType kind.
  for (const derived of derivedValues) {
    if (derived.valueType.kind !== "bool") {
      throw new Error(`emitReact: derived '${derived.id}' has unsupported valueType kind '${derived.valueType.kind}' (only 'bool' is supported)`);
    }
    const resolveRef = buildRefResolver(props, fields, resources);
    lines.push(`  const ${camelCase(derived.name)} = ${compileExprToJs(derived.expr, resolveRef)};`);
  }
  if (derivedValues.length > 0) lines.push(``);

  const resolveRef = buildRefResolver(props, fields, resources, derivedValues);

  for (const event of events) {
    if (!event.firesWhen) continue;
    const { prop: watchedProp, becomes } = event.firesWhen;
    const callbackName = `on${capitalize(event.name)}`;
    const prevRefName = `__prev${capitalize(watchedProp)}`;
    lines.push(`  const ${prevRefName} = React.useRef(${watchedProp});`);
    lines.push(`  React.useEffect(() => {`);
    lines.push(
      `    if (${prevRefName}.current !== ${watchedProp} && ${watchedProp} === ${JSON.stringify(becomes)}) ${callbackName}?.({});`
    );
    lines.push(`    ${prevRefName}.current = ${watchedProp};`);
    lines.push(`  }, [${watchedProp}]);`);
    lines.push(``);
  }

  const isButtonPattern = pattern?.pattern === "button";
  const isCheckboxPattern = pattern?.pattern === "checkbox";
  const rootTag = isButtonPattern ? "button" : isCheckboxPattern ? "input" : "div";
  // The only structural link between "a prop that mirrors current state" and "which state
  // that is" — see `machineSeedProp`'s own doc comment. Used both to seed the initial
  // `state` correctly (previously always `__machine.initialState`, ignoring e.g. `checked`
  // or `expanded` entirely) and, for the checkbox pattern, to know which state means checked.
  const seedProp = machineSeedProp(component);

  if (component.states.length > 0) {
    const initialState = seedProp
      ? `${seedProp.name} ? ${JSON.stringify(seedProp.name)} : __machine.initialState`
      : `__machine.initialState`;
    lines.push(`  const [state, setState] = React.useState<string>(${initialState});`);
    lines.push(``);
    lines.push(`  const dispatch = (eventName: string) => {`);
    lines.push(`    const env: any = { ${props.map((p) => p.name).join(", ")} };`);
    lines.push(`    const next = __machine.dispatch(state, eventName, env);`);
    lines.push(`    if (next) setState(next);`);
    lines.push(`  };`);
    lines.push(``);
  }

  // A real checkbox's own `checked`/`disabled` DOM properties already convey what
  // `data-state`/`aria-disabled` existed to express on a `<div role="checkbox">` — and
  // React warns at runtime if a controlled `checked` input has no `onChange`, so the
  // trigger's own dispatch handler (still semantically "click", matching the transitions'
  // own declared trigger name — only the DOM attribute it prints under changes) binds to
  // `onChange` here instead of `onClick`.
  const rootHandlers = lowerRootHandlers(component).map((h) =>
    isCheckboxPattern && h.on === "click" ? { ...h, on: "change" } : h
  );

  lines.push(`  return (`);
  lines.push(`    <${rootTag}`);
  lines.push(`      data-loom-component=${JSON.stringify(component.name)}`);
  if (styledParts.has("root")) lines.push(`      className=${JSON.stringify(partClassName(component.name, "root"))}`);
  if (component.states.length > 0 && !isCheckboxPattern) lines.push(`      data-state={state}`);
  if (isButtonPattern) {
    lines.push(`      type="button"`);
  } else if (isCheckboxPattern) {
    lines.push(`      type="checkbox"`);
    if (seedProp) lines.push(`      checked={state === ${JSON.stringify(seedProp.name)}}`);
  } else if (pattern) {
    lines.push(`      role=${JSON.stringify(pattern.pattern)}`);
  }
  if (disabledProp) lines.push(isButtonPattern || isCheckboxPattern ? `      disabled={disabled}` : `      aria-disabled={disabled}`);
  // A keydown handler is inert on an element that can never receive focus — `tabIndex={0}`
  // is what makes a keyboard trigger honestly operable, not just declared.
  if (hasKeydownHandler(rootHandlers)) lines.push(`      tabIndex={0}`);
  for (const attr of printHandlers(rootHandlers, fieldsByName)) lines.push(`      ${attr}`);
  if (isCheckboxPattern) {
    // `<input>` is a void element — no children, no closing tag. Checkbox declares no
    // slots, so there is nothing to lose by never reaching the child-printing branch below.
    lines.push(`    />`);
    lines.push(`  );`);
    lines.push(`}`, ``);
    return [{ path: `${componentName}.tsx`, contents: lines.join("\n") }];
  }
  lines.push(`    >`);
  if (rootUses) {
    // `visibleWhen`'s multi-line/parenthesized wrap is special-cased here,
    // at the composed root only — everywhere else `when` prints as a flat
    // inline `{cond && child}` (see `printInline`'s `"when"` case), matching
    // today's actual formatting exactly (the whole tree below the root is
    // built as one unbroken string; only the root wrap ever spans lines).
    const tree = lowerComposition(rootUses, component);
    if (tree.kind === "when") {
      lines.push(`      {${condToJs(tree.cond)} && (`);
      lines.push(`        ${printInline(tree.then[0]!, fieldsByName, resolveRef)}`);
      lines.push(`      )}`);
    } else {
      lines.push(`      ${printInline(tree, fieldsByName, resolveRef)}`);
    }
  } else {
    lines.push(...printRenderNodes(lower(component), component.name, styledParts));
  }
  lines.push(`    </${rootTag}>`);
  lines.push(`  );`);
  lines.push(`}`, ``);

  return [{ path: `${componentName}.tsx`, contents: lines.join("\n") }];
}
