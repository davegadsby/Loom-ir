import type { Attr, ComponentNode, DerivedNode, EmittedFile, EventNode, FieldNode, Handler, PropNode, RenderNode, UsesNode } from "loom-ir";
import { lower, lowerComposition, lowerRootHandlers } from "loom-ir";
import { partClassName } from "loom-emit-styles";
import {
  capitalize,
  camelCase,
  collectReferencedComponents,
  condToJs,
  hasComputedProps,
  hasDerivedValues,
  isComputedPropValue,
  loomTypeToTs,
  machineLines,
  objectKey,
  pascalCase,
} from "loom-emit-core";
import type { Expr } from "loom-expr";

/**
 * Prints the render tree `lower()` produces for the non-composition path.
 * Only `slot` is exercised yet (Phase 1b); every other `RenderNode` kind
 * throws rather than silently rendering nothing. Unlike React, Angular's
 * named-slot projections must print before the selector-less default
 * fallback regardless of declaration order — `<ng-content>` with no
 * `select` claims whatever the named selectors didn't, so it has to come
 * last. `lower()` keeps the tree itself in declaration order (React needs
 * that); this reordering is a real Angular-specific rendering decision, not
 * an IR concern.
 */
function printRenderNodes(nodes: readonly RenderNode[]): string {
  const slots = nodes.filter((n): n is Extract<RenderNode, { kind: "slot" }> => n.kind === "slot");
  const unsupported = nodes.find((n) => n.kind !== "slot");
  if (unsupported) throw new Error(`printRenderNodes: unsupported render node kind '${unsupported.kind}'`);

  const named = slots.filter((s) => s.name !== "default");
  const defaultSlot = slots.find((s) => s.name === "default");
  return [
    ...named.map((s) => `<ng-content select="[slot=${s.name}]"></ng-content>`),
    ...(defaultSlot ? ["<ng-content></ng-content>"] : []),
  ].join("");
}

/** Name of the class getter (or, for an each-template node, method) backing one composed node's one `{expr}` prop — e.g. `login-button` + `disabled` -> `loginButtonDisabled`. */
function computedPropGetterName(nodeName: string, propName: string): string {
  return `${camelCase(nodeName)}${capitalize(camelCase(propName))}`;
}

/** Name of the `trackBy` method backing one `each`'s `key` — e.g. ident `task` -> `trackByTask`. */
function trackByMethodName(ident: string): string {
  return `trackBy${capitalize(camelCase(ident))}`;
}

/**
 * Maps an each-template node's name to its bound ident. A zero-arg getter
 * can't see a loop variable — Angular's "emitters become printers" claim is
 * really "printer plus lambda-lifter" for exactly this reason (§ plan) — so
 * a template node's own computed-prop getters become parameterized methods
 * instead; this is what tells the getter-generation loop, and `printPropAttr`,
 * which nodes need that. Built once, from the composition array directly
 * (not from the render tree), the same way the getter-generation loop
 * already walks `component.composition` rather than a lowered tree.
 */
function eachTemplateIdents(nodes: readonly UsesNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    for (const content of Object.values(node.slotContent ?? {})) {
      if ("each" in content) map.set(content.each.use, content.each.as);
    }
  }
  return map;
}

/**
 * `{ propName: this.propName, fieldName: this.fieldName, fieldNameValid: this.fieldNameValid, ... }`
 * — the env a computed-prop getter, a derived value's own getter, or a
 * field's own validity evaluates against. `derived` is omitted by a derived
 * value's own getter (composition.ts checks its `expr` against only props/
 * fields, never another derived value) and included for a computed-prop
 * getter, which — like React's `__env` — may reference a declared derived
 * value by name.
 */
function envLiteral(props: readonly PropNode[], fields: readonly FieldNode[], derived: readonly DerivedNode[] = []): string {
  const parts = [
    ...props.map((p) => `${p.name}: this.${camelCase(p.name)}`),
    ...fields.flatMap((f) => {
      const c = camelCase(f.name);
      return [`${objectKey(f.name)}: this.${c}`, `${objectKey(`${f.name}Valid`)}: this.${c}Valid`];
    }),
    ...derived.map((d) => `${objectKey(d.name)}: this.${camelCase(d.name)}`),
  ];
  return `{ ${parts.join(", ")} }`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Static string props single-quote-bind (matching this file's existing convention); other literal types bind their JSON form directly — both valid Angular property-binding expression syntax. */
function angularBinding(key: string, value: unknown): string {
  return typeof value === "string" ? `[${key}]="'${value.replace(/'/g, "\\'")}'"` : `[${key}]="${JSON.stringify(value)}"`;
}

/** `boundIdent` set means `instanceName` is an each-template — the reference becomes a method call passing the loop variable, not a bare getter reference. */
function printPropAttr(k: string, expr: Expr, instanceName: string, boundIdent: string | undefined): string {
  if (expr.type === "literal") return angularBinding(k, expr.value);
  const name = computedPropGetterName(instanceName, k);
  return `[${k}]="${boundIdent ? `${name}(${boundIdent})` : name}"`;
}

/**
 * A constructed payload references its source bare — Angular template
 * expressions reach a class member directly, field or prop alike, with no
 * naming distinction the way React's `Value`-suffixed state has. Bare-string
 * `on` sugar lowers to an empty payload (matching `OnWireTarget`'s own
 * "empty-payload forward" doc comment): this used to instead forward
 * `$event`, which happened to be invisible in every current example only
 * because every source component's declared payload is itself `record{}`.
 */
function printEmitEffect(effect: Extract<Handler["effects"][number], { kind: "emit" }>): string {
  const payloadEntries = Object.entries(effect.payload).map(([k, expr]) => `${k}: ${(expr as Extract<Expr, { type: "ref" }>).name}`);
  return `${effect.event}.emit({ ${payloadEntries.join(", ")} })`;
}

/** `dispatch` calls the same `dispatch(eventName: string): void` method the class already declares whenever it has a machine — always present by the time a `dispatch` effect can exist, since `lowerRootHandlers` only ever produces one from an actual `TransitionNode.trigger`. Single-quoted, matching this file's own template-string-literal convention (not `JSON.stringify`, which is double-quoted). */
function printEffect(effect: Handler["effects"][number]): string {
  if (effect.kind === "dispatch") return `dispatch('${effect.event}')`;
  if (effect.kind !== "emit") throw new Error(`printEffect: unsupported effect kind '${effect.kind}'`);
  return printEmitEffect(effect);
}

function printHandlers(handlers: readonly Handler[]): string[] {
  return handlers.map((h) => {
    const calls = h.effects.map((e) => printEffect(e));
    return `(${h.on})="${calls.join("; ")}"`;
  });
}

/**
 * `over`/`key` on an `each` node are always a plain `ref`/`member` chain by
 * construction (`lower.ts` only ever builds them that way) — an Angular
 * template expression references a component member (or, inside an
 * `*ngFor`, its own template variable) bare, with no `this.` prefix, same
 * as every other template expression this file already prints.
 */
function printBareRef(expr: Expr): string {
  if (expr.type === "ref") return expr.name;
  if (expr.type === "member") return `${printBareRef(expr.target)}.${expr.property}`;
  throw new Error(`printBareRef: unsupported expr type '${expr.type}'`);
}

/**
 * `extraAttrsFirst` exists for two callers: `printWhen`, when a `when` wraps
 * a single element (a field's error span) — Angular attaches `*ngIf` as an
 * attribute on that element directly rather than wrapping it — and
 * `printInline`'s `each` case, attaching `*ngFor` the same way, unlike an
 * `instance`, which always gets a real `<ng-container>` wrapper (an element
 * has no separate "outer" tag to wrap with; an instance's own tag already
 * exists to carry other bindings).
 */
function printElement(node: Extract<RenderNode, { kind: "element" }>, eachIdents: ReadonlyMap<string, string>, extraAttrsFirst: string[] = []): string {
  const staticAttrs = node.attrs.map((a) => {
    if (a.kind !== "static") throw new Error(`printElement: unsupported attr kind '${a.kind}'`);
    return `${a.name}="${a.value}"`;
  });
  let dynamicAttrs: string[] = [];
  if (node.tag === "input") {
    const nameAttr = node.attrs.find((a) => a.kind === "static" && a.name === "name") as Extract<Attr, { kind: "static" }>;
    const camel = camelCase(nameAttr.value);
    const Camel = capitalize(camel);
    dynamicAttrs = [`[value]="${camel}"`, `(input)="on${Camel}Input($event)"`, `[attr.aria-invalid]="${camel}Touched && !${camel}Valid"`];
  }
  const attrsStr = [...extraAttrsFirst, ...staticAttrs, ...dynamicAttrs].join(" ");
  if (node.children.length === 0) return `<${node.tag} ${attrsStr} />`;
  return `<${node.tag} ${attrsStr}>${node.children.map((c) => printInline(c, eachIdents)).join("")}</${node.tag}>`;
}

function printInstance(
  node: Extract<RenderNode, { kind: "instance" }>,
  eachIdents: ReadonlyMap<string, string>,
  extraAttrsFirst: string[] = []
): string {
  const selector = `loom-${node.component.name}`;
  const refSlots = node.component.declarations.filter((d) => d.kind === "slot");
  const boundIdent = eachIdents.get(node.name);

  const propAttrs = Object.entries(node.props).map(([k, expr]) => printPropAttr(k, expr, node.name, boundIdent));

  const body: string[] = [];
  for (const slot of refSlots) {
    const fillNodes = node.fills[slot.name];
    if (!fillNodes) continue;
    const inner = fillNodes.map((n) => printInline(n, eachIdents)).join("");
    body.push(slot.name === "default" ? inner : `<div slot="${slot.name}">${inner}</div>`);
  }

  const attrs = [...extraAttrsFirst, ...propAttrs, ...printHandlers(node.handlers)];
  const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `<${selector}${attrsStr}>${body.join("")}</${selector}>`;
}

/**
 * See `printElement`'s doc comment for the element-vs-instance distinction.
 * The generic multi-child `<ng-container>` fallback is defensive — no
 * current example produces a `when` whose `then` isn't a single element or
 * a single instance.
 */
function printWhen(node: Extract<RenderNode, { kind: "when" }>, eachIdents: ReadonlyMap<string, string>): string {
  const condJs = condToJs(node.cond);
  const only = node.then.length === 1 ? node.then[0]! : undefined;
  if (only?.kind === "instance") return `<ng-container *ngIf="${condJs}">${printInstance(only, eachIdents)}</ng-container>`;
  if (only?.kind === "element") return printElement(only, eachIdents, [`*ngIf="${condJs}"`]);
  return `<ng-container *ngIf="${condJs}">${node.then.map((c) => printInline(c, eachIdents)).join("")}</ng-container>`;
}

/**
 * Prints one lowered composition subtree as Angular template markup. Unlike
 * React, this needs no root/nested distinction — Angular's whole template
 * is always one flat string, so `visibleWhen` (lowered to a root-wrapping
 * `when`) prints through the exact same path as a nested field-error `when`.
 * `slot` doesn't appear in a composition tree (Phase 1b's path is distinct),
 * so it isn't handled here. `fragment` prints as bare concatenation — unlike
 * React, Angular has no fragment-wrapper syntax at all.
 *
 * `eachIdents` (built once by `eachTemplateIdents`) tells `printInstance`
 * which node, if any, is the current `each`'s template, so its `{expr}`
 * props print as a method call passing the loop variable rather than a
 * bare getter reference.
 */
function printInline(node: RenderNode, eachIdents: ReadonlyMap<string, string>): string {
  switch (node.kind) {
    case "text":
      return escapeHtml(String((node.value as Extract<Expr, { type: "literal" }>).value));
    case "fragment":
      return node.children.map((c) => printInline(c, eachIdents)).join("");
    case "when":
      return printWhen(node, eachIdents);
    case "each": {
      const only = node.body[0]!;
      if (node.body.length !== 1 || only.kind !== "instance") {
        throw new Error(`printInline: 'each' body must be a single instance, got ${node.body.map((n) => n.kind).join(", ")}`);
      }
      const source = printBareRef(node.over);
      const trackBy = node.key ? `; trackBy: ${trackByMethodName(node.ident)}` : "";
      const ngFor = `*ngFor="let ${node.ident} of ${source}${trackBy}"`;
      return printInstance(only, eachIdents, [ngFor]);
    }
    case "element":
      return printElement(node, eachIdents);
    case "instance":
      return printInstance(node, eachIdents);
    default:
      throw new Error(`printInline: unsupported render node kind '${node.kind}'`);
  }
}

/** `ngOnChanges` body firing every declared event whose `firesWhen` prop transitions to its target value — never on the initial mount. */
function firesWhenLines(events: readonly EventNode[]): string[] {
  const withFiresWhen = events.filter((e): e is EventNode & { firesWhen: NonNullable<EventNode["firesWhen"]> } => !!e.firesWhen);
  if (withFiresWhen.length === 0) return [];
  const lines = [`  ngOnChanges(changes: SimpleChanges): void {`];
  for (const event of withFiresWhen) {
    const { prop, becomes } = event.firesWhen;
    lines.push(
      `    if ('${prop}' in changes && !changes['${prop}'].firstChange && changes['${prop}'].currentValue === ${JSON.stringify(becomes)}) {`
    );
    lines.push(`      this.${event.name}.emit({});`);
    lines.push(`    }`);
  }
  lines.push(`  }`, ``);
  return lines;
}

/**
 * Compiles a `ComponentNode` to a minimal standalone Angular component
 * (§4/§14 step 7 — the second framework target, and the real test of
 * whether the IR is genuinely framework-agnostic).
 *
 * Deliberately mirrors loom-emit-react's strategy exactly: the same
 * `Declarations` nodes become typed `@Input`/`@Output` members, the same
 * machine is instantiated at runtime as a loom-expr `LoomMachine`, and
 * `MethodNode` is skipped the same way. Only the framework idiom differs
 * (decorators + a template string vs. JSX) — porting cost was a rename of
 * the surface syntax, not a redesign, which is the concrete evidence for
 * §4's "one IR, many targets" claim. `SlotNode` is the one place the two
 * backends genuinely diverge in mechanism rather than just syntax: React
 * has no native named-slot concept so each slot becomes a typed prop,
 * while Angular projects content by CSS selector, so each slot becomes an
 * `<ng-content select="...">` instead — same IR node, the idiomatic
 * mechanism for each framework.
 *
 * If the component has a `Composition` section, the root `UsesNode` is
 * recursively rendered inside the wrapper `<div>` (wrapped in
 * `<ng-container *ngIf="...">` when `visibleWhen` is set), each distinct
 * referenced component imported and added to the standalone `imports:`
 * array (real, current Angular API — a standalone component's template may
 * only use another standalone component's selector if it's listed there).
 * `EventNode.firesWhen` is implemented via the `OnChanges` lifecycle hook.
 */
export function emitAngular(component: ComponentNode): EmittedFile[] {
  const componentName = pascalCase(component.name);
  const selector = `loom-${component.name}`;
  const unsupported = component.declarations.filter((d) => d.kind === "method");
  for (const node of unsupported) {
    // eslint-disable-next-line no-console
    console.warn(`[loom-emit-angular] '${node.id}' (kind: method) is unsupported by this backend; skipped.`);
  }

  const props = component.declarations.filter((d) => d.kind === "prop");
  const events = component.declarations.filter((d) => d.kind === "event");
  const slots = component.declarations.filter((d) => d.kind === "slot");
  const pattern = component.a11y.find((n) => n.kind === "pattern-conformance");
  const disabledProp = props.find((p) => p.name === "disabled");
  const hasMachine = component.states.length > 0;
  // `VisualConformanceNode` carries no CSS (§ Style scope), so it doesn't count toward "this part is styled."
  // Only `"root"` can ever apply here: unlike React, Angular's named slots are
  // `<ng-content>` projections into caller-supplied markup, not a div this
  // backend renders itself, so there's no wrapper node of Angular's own to
  // attach a slot's class to (same DOM-ownership limit the Style scope note
  // in loom-ir/src/nodes.ts already states — this is just where it bites).
  const styledParts = new Set(component.style.filter((n) => n.kind !== "visual-conformance").map((n) => n.part));
  const rootUses = component.composition.find((n) => n.root);
  const referencedComponents = collectReferencedComponents(component.composition);
  const usesNgIf = !!rootUses?.visibleWhen;
  const hasFiresWhen = events.some((e) => e.firesWhen);
  const fields = component.declarations.filter((d): d is FieldNode => d.kind === "field");
  const derivedValues = component.declarations.filter((d): d is DerivedNode => d.kind === "derived");
  const needsEvaluate = fields.length > 0 || hasComputedProps(component.composition) || hasDerivedValues(component.declarations);

  const coreImports = ["Component", "EventEmitter", "Input", "Output"];
  if (hasFiresWhen) coreImports.push("OnChanges", "SimpleChanges");

  const lines: string[] = [
    `// GENERATED by loom-emit-angular. Do not edit by hand.`,
    unsupported.length > 0
      ? `// Unsupported by this backend: ${unsupported.map((n) => n.id).join(", ")}`
      : undefined,
    `import { ${coreImports.join(", ")} } from "@angular/core";`,
    usesNgIf ? `import { NgIf } from "@angular/common";` : undefined,
    hasMachine ? `import { LoomMachine, Transition, Guard } from "loom-expr";` : undefined,
    needsEvaluate ? `import { evaluate } from "loom-expr";` : undefined,
    ...referencedComponents.map((c) => `import { ${pascalCase(c.name)}Component } from "./${pascalCase(c.name)}.component";`),
    ``,
  ].filter((l): l is string => l !== undefined);

  if (hasMachine) {
    lines.push(...machineLines(component));
  }

  // Static string values are bound as single-quoted TS literals inside the
  // double-quoted HTML attribute value — reusing JSON.stringify (double
  // quotes) here would collide with the surrounding template-string quoting.
  const attrs: string[] = [`[attr.data-loom-component]="'${component.name}'"`];
  if (styledParts.has("root")) attrs.push(`class="${partClassName(component.name, "root")}"`);
  if (hasMachine) attrs.push(`[attr.data-state]="state"`);
  if (pattern) attrs.push(`[attr.role]="'${pattern.pattern}'"`);
  if (disabledProp) attrs.push(`[attr.aria-disabled]="disabled"`);
  attrs.push(...printHandlers(lowerRootHandlers(component)));
  // Angular projects by CSS selector against the light DOM, not by prop —
  // a named slot becomes `<ng-content select="[slot=name]">`, matching
  // `<div slot="name">` markup the consumer provides. The selector-less
  // `<ng-content>` for a "default" slot is emitted last so it only picks up
  // whatever the named selectors didn't already claim.
  // Unlike React, `visibleWhen` needs no special casing here: it's lowered
  // into the same `when` node a nested field-error gets, and `printInline`
  // handles both identically (see its doc comment for why that's safe here
  // but not for React).
  const eachIdents = eachTemplateIdents(component.composition);
  const templateBody = rootUses ? printInline(lowerComposition(rootUses, component), eachIdents) : printRenderNodes(lower(component));
  const template = `<div ${attrs.join(" ")}>${templateBody}</div>`;

  const importsArr = [...referencedComponents.map((c) => `${pascalCase(c.name)}Component`), ...(usesNgIf ? ["NgIf"] : [])];

  lines.push(`@Component({`);
  lines.push(`  selector: ${JSON.stringify(selector)},`);
  lines.push(`  standalone: true,`);
  if (importsArr.length > 0) lines.push(`  imports: [${importsArr.join(", ")}],`);
  lines.push(`  template: \`${template}\`,`);
  if (styledParts.size > 0) lines.push(`  styleUrls: [${JSON.stringify(`./${componentName}.css`)}],`);
  lines.push(`})`);
  lines.push(`export class ${componentName}Component${hasFiresWhen ? " implements OnChanges" : ""} {`);

  for (const prop of props) {
    lines.push(`  /** ${prop.id} */`);
    lines.push(`  @Input() ${prop.name}: ${loomTypeToTs(prop.valueType)} = ${JSON.stringify(prop.defaultValue ?? null)};`);
  }
  for (const event of events) {
    lines.push(`  /** ${event.id} */`);
    lines.push(`  @Output() ${event.name} = new EventEmitter<${loomTypeToTs(event.payloadType)}>();`);
  }

  for (const field of fields) {
    const camel = camelCase(field.name);
    const Camel = capitalize(camel);
    lines.push(`  ${camel}: string = ${JSON.stringify(field.initialValue ?? "")};`);
    lines.push(`  ${camel}Touched: boolean = false;`);
    const validExpr = field.validate
      ? `evaluate(${JSON.stringify(field.validate)}, { ${field.name}: this.${camel} }) === true`
      : `true`;
    lines.push(`  get ${camel}Valid(): boolean {`);
    lines.push(`    return ${validExpr};`);
    lines.push(`  }`);
    lines.push(`  on${Camel}Input(event: Event): void {`);
    lines.push(`    this.${camel} = (event.target as HTMLInputElement).value;`);
    lines.push(`    this.${camel}Touched = true;`);
    lines.push(`  }`);
    lines.push(``);
  }

  // A derived value's own getter is unconditional (bool-only for now — nothing yet needs
  // another valueType kind); a computed-prop getter's env additionally exposes derived names,
  // so a composed `{ expr }` prop can reference one by name instead of repeating its expression.
  for (const derived of derivedValues) {
    if (derived.valueType.kind !== "bool") {
      throw new Error(`emitAngular: derived '${derived.id}' has unsupported valueType kind '${derived.valueType.kind}' (only 'bool' is supported)`);
    }
    lines.push(`  get ${camelCase(derived.name)}(): boolean {`);
    lines.push(`    return evaluate(${JSON.stringify(derived.expr)}, ${envLiteral(props, fields)}) === true;`);
    lines.push(`  }`);
    lines.push(``);
  }

  // A template node's own computed-prop {expr}s become parameterized methods, not zero-arg
  // getters — a getter can't see the each's own loop variable (§ eachTemplateIdents' doc comment,
  // "printer plus lambda-lifter"). Every other computed prop keeps the plain getter form.
  for (const node of component.composition) {
    const boundIdent = eachIdents.get(node.name);
    for (const [propName, value] of Object.entries(node.props ?? {})) {
      if (!isComputedPropValue(value)) continue;
      const declaredType = node.resolvedComponent.declarations.find(
        (d): d is PropNode => d.kind === "prop" && d.name === propName
      )!.valueType;
      const tsType = loomTypeToTs(declaredType);
      const env = boundIdent ? `{ ...${envLiteral(props, fields, derivedValues)}, ${boundIdent} }` : envLiteral(props, fields, derivedValues);
      const call = `evaluate(${JSON.stringify(value.expr)}, ${env})`;
      const result = declaredType.kind === "bool" ? `${call} === true` : `${call} as ${tsType}`;
      const name = computedPropGetterName(node.name, propName);
      if (boundIdent) {
        lines.push(`  ${name}(${boundIdent}: any): ${tsType} {`);
      } else {
        lines.push(`  get ${name}(): ${tsType} {`);
      }
      lines.push(`    return ${result};`);
      lines.push(`  }`);
      lines.push(``);
    }
  }

  // One `trackBy` method per each.key — the function form Angular's `*ngFor` trackBy requires,
  // not an inline expression the way React's `key={...}` is.
  for (const node of component.composition) {
    for (const content of Object.values(node.slotContent ?? {})) {
      if (!("each" in content) || !content.each.key) continue;
      const { as, key } = content.each;
      lines.push(`  ${trackByMethodName(as)}(index: number, ${as}: any): any {`);
      lines.push(`    return ${as}.${key};`);
      lines.push(`  }`);
      lines.push(``);
    }
  }

  lines.push(...firesWhenLines(events));

  if (hasMachine) {
    lines.push(`  state: string = __machine.initialState;`);
    lines.push(``);
    lines.push(`  dispatch(eventName: string): void {`);
    lines.push(`    const env: any = { ${props.map((p) => `${p.name}: this.${p.name}`).join(", ")} };`);
    lines.push(`    const next = __machine.dispatch(this.state, eventName, env);`);
    lines.push(`    if (next) this.state = next;`);
    lines.push(`  }`);
  }

  lines.push(`}`, ``);

  return [{ path: `${componentName}.component.ts`, contents: lines.join("\n") }];
}
