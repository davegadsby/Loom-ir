import type { ComponentNode, EmittedFile, FieldNode, OnWireTarget, UsesNode } from "loom-ir";
import { partClassName } from "loom-emit-styles";
import { loomTypeToTs } from "./loomTypeToTs.js";

function isComputedPropValue(v: unknown): v is { expr: unknown } {
  return v !== null && typeof v === "object" && !Array.isArray(v) && "expr" in v;
}

function hasComputedProps(nodes: readonly UsesNode[]): boolean {
  return nodes.some((n) => Object.values(n.props ?? {}).some(isComputedPropValue));
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function pascalCase(slug: string): string {
  return slug.split("-").map(capitalize).join("");
}

/** Slot/prop names come from spec slugs and may contain hyphens, which aren't valid in a JS identifier. */
function camelCase(slug: string): string {
  const [first, ...rest] = slug.split("-");
  return [first, ...rest.map(capitalize)].join("");
}

/** The default slot maps to React's built-in `children`; every other slot becomes its own named prop. */
function slotPropName(slotName: string): string {
  return slotName === "default" ? "children" : camelCase(slotName);
}

function stateLiteral(state: ComponentNode["states"][number]): string {
  return JSON.stringify({ id: state.name, ...state.flags });
}

/**
 * One `new Transition({...})` call, guard included as `Guard.from(expr)` —
 * states are plain data (no behavior to encapsulate), but a transition's
 * matching logic and a guard's evaluation are exactly what these classes
 * exist to own, so they're instantiated explicitly rather than left as
 * anonymous nested object literals.
 */
function transitionLines(transition: ComponentNode["transitions"][number], indent: string): string[] {
  const lines = [
    `${indent}new Transition({`,
    `${indent}  id: ${JSON.stringify(transition.name)},`,
    `${indent}  from: ${JSON.stringify(transition.from)},`,
    `${indent}  to: ${JSON.stringify(transition.to)},`,
    `${indent}  trigger: ${JSON.stringify(transition.trigger)},`,
  ];
  if (transition.guard) lines.push(`${indent}  guard: Guard.from(${JSON.stringify(transition.guard)}),`);
  lines.push(`${indent}}),`);
  return lines;
}

/** `const __machine = new LoomMachine({ ... })`, formatted as readable multi-line source rather than one JSON line. */
function machineLines(component: ComponentNode): string[] {
  const lines: string[] = [`const __machine = new LoomMachine({`, `  states: [`];
  for (const state of component.states) lines.push(`    ${stateLiteral(state)},`);
  lines.push(`  ],`, `  transitions: [`);
  for (const transition of component.transitions) lines.push(...transitionLines(transition, "    "));
  lines.push(`  ],`, `});`, ``);
  return lines;
}

/** Every distinct component reached by a composition tree, sorted for deterministic import ordering. */
function collectReferencedComponents(nodes: readonly UsesNode[]): ComponentNode[] {
  const seen = new Map<string, ComponentNode>();
  for (const node of nodes) {
    if (!seen.has(node.resolvedComponent.name)) seen.set(node.resolvedComponent.name, node.resolvedComponent);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A native `<input>` bound to this field's own local state — `value`/
 * `touched` are recomputed/set together on every keystroke, `<name>Valid`
 * is recomputed inline from `evaluate()` each render, and the invalid
 * message (if any) only shows once the field has been touched.
 */
function renderFieldJsx(field: FieldNode): string {
  const camel = camelCase(field.name);
  const Camel = capitalize(camel);
  const inputType = field.secret ? "password" : "text";
  const parts = [
    `<input type=${JSON.stringify(inputType)} name=${JSON.stringify(field.name)} value={${camel}Value} onChange={handle${Camel}Change} aria-invalid={${camel}Touched && !${camel}Valid} />`,
  ];
  if (field.invalidMessage) {
    parts.push(
      `{${camel}Touched && !${camel}Valid && <span data-loom-field-error=${JSON.stringify(field.name)}>{${JSON.stringify(field.invalidMessage)}}</span>}`
    );
  }
  return `<React.Fragment>${parts.join("")}</React.Fragment>`;
}

/**
 * Recursively renders one `UsesNode` (and, through `slotContent.*.uses`/
 * `slotContent.*.fields`, its nested children/native fields) as a JSX
 * element. A resolved child's own props interface already types each
 * non-default slot as `React.ReactNode`, so slot content becomes a JSX
 * attribute (`actions={...}`), never raw children — React has no per-slot
 * child-targeting mechanism. A `{ expr }` prop value is evaluated live
 * against `__env` (the enclosing component's own props + field state).
 * `on` wiring adds one or more extra callback invocations reusing the same
 * `on${Capitalize(name)}` naming convention the props interface generator
 * uses elsewhere in this file, with each wire's `payload` sourced from a
 * sibling field's current value or the enclosing component's own prop.
 */
function renderUsesJsx(node: UsesNode, byName: ReadonlyMap<string, UsesNode>, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  const ref = node.resolvedComponent;
  const refName = pascalCase(ref.name);
  const refSlots = ref.declarations.filter((d) => d.kind === "slot");

  const propAttrs = Object.entries(node.props ?? {}).map(([k, v]) =>
    isComputedPropValue(v) ? `${k}={evaluate(${JSON.stringify(v.expr)}, __env) === true}` : `${k}={${JSON.stringify(v)}}`
  );

  const namedSlotAttrs: string[] = [];
  let defaultChildrenExpr: string | undefined;
  for (const slot of refSlots) {
    const content = node.slotContent?.[slot.name];
    if (!content) continue;
    const rendered =
      "text" in content
        ? JSON.stringify(content.text)
        : "uses" in content
          ? `<>${content.uses.map((n) => renderUsesJsx(byName.get(n)!, byName, fieldsByName)).join("")}</>`
          : `<>${content.fields.map((n) => renderFieldJsx(fieldsByName.get(n)!)).join("")}</>`;
    if (slot.name === "default") {
      defaultChildrenExpr = rendered;
    } else {
      namedSlotAttrs.push(`${slotPropName(slot.name)}={${rendered}}`);
    }
  }

  const onAttrs = Object.entries(node.on ?? {}).map(([childEventName, wireRaw]) => {
    const wires = Array.isArray(wireRaw) ? wireRaw : [wireRaw];
    const calls = wires.map((w) => {
      const target: OnWireTarget = typeof w === "string" ? { event: w } : w;
      const payloadEntries = Object.entries(target.payload ?? {}).map(
        ([k, source]) => `${k}: ${fieldsByName.has(source) ? `${camelCase(source)}Value` : source}`
      );
      return `on${capitalize(target.event)}?.({ ${payloadEntries.join(", ")} });`;
    });
    return `on${capitalize(childEventName)}={() => { ${calls.join(" ")} }}`;
  });

  const attrs = [...propAttrs, ...namedSlotAttrs, ...onAttrs];
  const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return defaultChildrenExpr !== undefined
    ? `<${refName}${attrsStr}>{${defaultChildrenExpr}}</${refName}>`
    : `<${refName}${attrsStr} />`;
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
    const byName = new Map(component.composition.map((n) => [n.name, n] as const));
    const composedJsx = renderUsesJsx(rootUses, byName, fieldsByName);
    if (rootUses.visibleWhen) {
      lines.push(`      {${rootUses.visibleWhen} && (`);
      lines.push(`        ${composedJsx}`);
      lines.push(`      )}`);
    } else {
      lines.push(`      ${composedJsx}`);
    }
  } else {
    for (const slot of slots) {
      const varName = slotPropName(slot.name);
      if (slot.name === "default") {
        lines.push(`      {children}`);
      } else {
        const classAttr = styledParts.has(slot.name)
          ? ` className=${JSON.stringify(partClassName(component.name, slot.name))}`
          : "";
        lines.push(`      <div data-loom-slot=${JSON.stringify(slot.name)}${classAttr}>{${varName}}</div>`);
      }
    }
  }
  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`, ``);

  return [{ path: `${componentName}.tsx`, contents: lines.join("\n") }];
}
