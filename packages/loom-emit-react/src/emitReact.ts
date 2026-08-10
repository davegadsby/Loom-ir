import type { ComponentNode, EmittedFile, FieldNode, Handler, RenderNode } from "loom-ir";
import { lower, lowerComposition } from "loom-ir";
import type { Expr } from "loom-expr";
import { partClassName } from "loom-emit-styles";
import {
  capitalize,
  camelCase,
  collectReferencedComponents,
  condToJs,
  hasComputedProps,
  loomTypeToTs,
  machineLines,
  pascalCase,
} from "loom-emit-core";

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

/** A literal prop prints its raw value directly; anything else is a computed `{expr}` prop, live-evaluated against `__env`. */
function printPropExpr(expr: Expr): string {
  return expr.type === "literal" ? JSON.stringify(expr.value) : `evaluate(${JSON.stringify(expr)}, __env) === true`;
}

/**
 * `emit` is the only effect kind composition lowers to yet. `"forward"` (the
 * lowered form of bare-string `on` sugar) has no React equivalent — React
 * callbacks are always an explicit constructed object, never a raw DOM
 * event — so it prints an empty payload, matching today's actual (if
 * arguably surprising) behavior rather than inventing new semantics here.
 * A field-sourced payload value carries a `Value` suffix (React's field
 * state variable is named `<name>Value`); a prop-sourced one prints as-is.
 */
function printEmitEffect(effect: Extract<Handler["effects"][number], { kind: "emit" }>, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  const payloadEntries =
    effect.payload === "forward"
      ? []
      : Object.entries(effect.payload).map(([k, expr]) => {
          const source = (expr as Extract<Expr, { type: "ref" }>).name;
          return `${k}: ${fieldsByName.has(source) ? `${camelCase(source)}Value` : source}`;
        });
  return `on${capitalize(effect.event)}?.({ ${payloadEntries.join(", ")} });`;
}

function printHandlers(handlers: readonly Handler[], fieldsByName: ReadonlyMap<string, FieldNode>): string[] {
  return handlers.map((h) => {
    const calls = h.effects.map((e) => {
      if (e.kind !== "emit") throw new Error(`printHandlers: unsupported effect kind '${e.kind}'`);
      return printEmitEffect(e, fieldsByName);
    });
    return `on${capitalize(h.on)}={() => { ${calls.join(" ")} }}`;
  });
}

/**
 * A `text` node needs `{}` braces only when it appears as a JSX element
 * child (a bare JS string isn't valid JSX text) — as an attribute value or
 * inside a fragment, the caller already supplies the one wrapping `{}` an
 * attribute needs. Every other kind already prints valid JSX on its own.
 */
function printElementChild(node: RenderNode, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  return node.kind === "text" ? `{${printInline(node, fieldsByName)}}` : printInline(node, fieldsByName);
}

/**
 * Prints one lowered composition subtree as a flat JSX expression string —
 * no internal newlines; only the composed root's `visibleWhen` wrap (handled
 * by its caller in `emitReact`) is ever multi-line. `slot` doesn't appear in
 * a composition tree (Phase 1b's path is a distinct, non-composed one), so
 * it isn't handled here.
 */
function printInline(node: RenderNode, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  switch (node.kind) {
    case "text":
      return JSON.stringify((node.value as Extract<Expr, { type: "literal" }>).value);
    case "fragment": {
      const inner = node.children.map((c) => printInline(c, fieldsByName)).join("");
      return `<>${inner}</>`;
    }
    case "when": {
      const cond = condToJs(node.cond);
      const inner = node.then.map((c) => printInline(c, fieldsByName)).join("");
      return `{${cond} && ${inner}}`;
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
      const attrsStr = [...staticAttrs, ...dynamicAttrs].join(" ");
      if (node.children.length === 0) return `<${node.tag} ${attrsStr} />`;
      const inner = node.children.map((c) => printElementChild(c, fieldsByName)).join("");
      return `<${node.tag} ${attrsStr}>${inner}</${node.tag}>`;
    }
    case "instance": {
      const refName = pascalCase(node.component.name);
      const refSlots = node.component.declarations.filter((d) => d.kind === "slot");

      const propAttrs = Object.entries(node.props).map(([k, expr]) => `${k}={${printPropExpr(expr)}}`);

      const namedSlotAttrs: string[] = [];
      let defaultChildrenExpr: string | undefined;
      for (const slot of refSlots) {
        const fillNodes = node.fills[slot.name];
        if (!fillNodes) continue;
        const rendered = fillNodes.map((n) => printInline(n, fieldsByName)).join("");
        if (slot.name === "default") defaultChildrenExpr = rendered;
        else namedSlotAttrs.push(`${slotPropName(slot.name)}={${rendered}}`);
      }

      const onAttrs = printHandlers(node.handlers, fieldsByName);

      const attrs = [...propAttrs, ...namedSlotAttrs, ...onAttrs];
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
 * guard into bespoke JS. Only a generic `click` interaction is wired up for
 * now (key/pointer triggers are a backend TODO); `MethodNode`s have no
 * React rendering strategy yet and are skipped rather than failing the
 * whole emission (§14 step 5's "skip, don't throw" contract). If any `part`
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
  const pattern = component.a11y.find((n) => n.kind === "pattern-conformance");
  const disabledProp = props.find((p) => p.name === "disabled");
  // `VisualConformanceNode` carries no CSS (§ Style scope), so it doesn't count toward "this part is styled."
  const styledParts = new Set(component.style.filter((n) => n.kind !== "visual-conformance").map((n) => n.part));
  const rootUses = component.composition.find((n) => n.root);
  const referencedComponents = collectReferencedComponents(component.composition);
  const fields = component.declarations.filter((d): d is FieldNode => d.kind === "field");
  const fieldsByName = new Map(fields.map((f) => [f.name, f] as const));
  const needsEvaluate = fields.length > 0 || hasComputedProps(component.composition);

  const lines: string[] = [
    `// GENERATED by loom-emit-react. Do not edit by hand.`,
    unsupported.length > 0
      ? `// Unsupported by this backend: ${unsupported.map((n) => n.id).join(", ")}`
      : undefined,
    `import * as React from "react";`,
    component.transitions.length > 0 ? `import { LoomMachine, Transition, Guard } from "loom-expr";` : undefined,
    needsEvaluate ? `import { evaluate } from "loom-expr";` : undefined,
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
  const eventCallbackNames = events.map((e) => `on${capitalize(e.name)}`);
  if (destructured.length > 0 || slots.length > 0 || eventCallbackNames.length > 0) {
    const parts = [...destructured, ...slots.map((s) => slotPropName(s.name)), ...eventCallbackNames];
    lines.push(`  const { ${parts.join(", ")} } = props;`);
  }

  for (const field of fields) {
    const camel = camelCase(field.name);
    const Camel = capitalize(camel);
    lines.push(`  const [${camel}Value, set${Camel}Value] = React.useState<string>(${JSON.stringify(field.initialValue ?? "")});`);
    lines.push(`  const [${camel}Touched, set${Camel}Touched] = React.useState<boolean>(false);`);
    const validExpr = field.validate
      ? `evaluate(${JSON.stringify(field.validate)}, { ${field.name}: ${camel}Value }) === true`
      : `true`;
    lines.push(`  const ${camel}Valid = ${validExpr};`);
    lines.push(`  const handle${Camel}Change = (e: React.ChangeEvent<HTMLInputElement>) => {`);
    lines.push(`    set${Camel}Value(e.target.value);`);
    lines.push(`    set${Camel}Touched(true);`);
    lines.push(`  };`);
  }
  if (fields.length > 0) lines.push(``);

  if (hasComputedProps(component.composition)) {
    const envParts = [
      ...props.map((p) => p.name),
      ...fields.flatMap((f) => [`${f.name}: ${camelCase(f.name)}Value`, `${f.name}Valid: ${camelCase(f.name)}Valid`]),
    ];
    lines.push(`  const __env: any = { ${envParts.join(", ")} };`);
    lines.push(``);
  }

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

  if (component.states.length > 0) {
    lines.push(`  const [state, setState] = React.useState<string>(__machine.initialState);`);
    lines.push(``);
    lines.push(`  const dispatch = (eventName: string) => {`);
    lines.push(`    const env: any = { ${props.map((p) => p.name).join(", ")} };`);
    lines.push(`    const next = __machine.dispatch(state, eventName, env);`);
    lines.push(`    if (next) setState(next);`);
    lines.push(`  };`);
    lines.push(``);
  }

  lines.push(`  return (`);
  lines.push(`    <div`);
  lines.push(`      data-loom-component=${JSON.stringify(component.name)}`);
  if (styledParts.has("root")) lines.push(`      className=${JSON.stringify(partClassName(component.name, "root"))}`);
  if (component.states.length > 0) lines.push(`      data-state={state}`);
  if (pattern) lines.push(`      role=${JSON.stringify(pattern.pattern)}`);
  if (disabledProp) lines.push(`      aria-disabled={disabled}`);
  if (component.transitions.length > 0) lines.push(`      onClick={() => dispatch("click")}`);
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
      lines.push(`        ${printInline(tree.then[0]!, fieldsByName)}`);
      lines.push(`      )}`);
    } else {
      lines.push(`      ${printInline(tree, fieldsByName)}`);
    }
  } else {
    lines.push(...printRenderNodes(lower(component), component.name, styledParts));
  }
  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`, ``);

  return [{ path: `${componentName}.tsx`, contents: lines.join("\n") }];
}
