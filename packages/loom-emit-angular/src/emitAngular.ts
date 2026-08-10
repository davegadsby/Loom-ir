import type { Attr, ComponentNode, EmittedFile, EventNode, FieldNode, Handler, PropNode, RenderNode } from "loom-ir";
import { lower, lowerComposition } from "loom-ir";
import { partClassName } from "loom-emit-styles";
import {
  capitalize,
  camelCase,
  collectReferencedComponents,
  condToJs,
  hasComputedProps,
  isComputedPropValue,
  loomTypeToTs,
  machineLines,
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

/** Name of the class getter backing one composed node's one `{expr}` prop — e.g. `login-button` + `disabled` -> `loginButtonDisabled`. */
function computedPropGetterName(nodeName: string, propName: string): string {
  return `${camelCase(nodeName)}${capitalize(camelCase(propName))}`;
}

/** `{ propName: this.propName, fieldName: this.fieldName, fieldNameValid: this.fieldNameValid, ... }` — the env a computed-prop getter or a field's own validity evaluates against. */
function envLiteral(props: readonly PropNode[], fields: readonly FieldNode[]): string {
  const parts = [
    ...props.map((p) => `${p.name}: this.${camelCase(p.name)}`),
    ...fields.flatMap((f) => {
      const c = camelCase(f.name);
      return [`${f.name}: this.${c}`, `${f.name}Valid: this.${c}Valid`];
    }),
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

function printPropAttr(k: string, expr: Expr, instanceName: string): string {
  return expr.type === "literal" ? angularBinding(k, expr.value) : `[${k}]="${computedPropGetterName(instanceName, k)}"`;
}

/**
 * `payload: "forward"` (bare-string `on` sugar, lowered) forwards whatever
 * the child emitted — Angular's `$event` genuinely can carry that, unlike
 * React's callback-only model, so this backend honors it rather than
 * discarding it (see `printEmitEffect` in `loom-emit-react` for the
 * opposite, currently-divergent choice — unifying the two is Phase 1d's
 * job). A constructed payload references its source bare — Angular
 * template expressions reach a class member directly, field or prop alike,
 * with no naming distinction the way React's `Value`-suffixed state does.
 */
function printEmitEffect(effect: Extract<Handler["effects"][number], { kind: "emit" }>): string {
  if (effect.payload === "forward") return `${effect.event}.emit($event)`;
  const payloadEntries = Object.entries(effect.payload).map(([k, expr]) => `${k}: ${(expr as Extract<Expr, { type: "ref" }>).name}`);
  return `${effect.event}.emit({ ${payloadEntries.join(", ")} })`;
}

function printHandlers(handlers: readonly Handler[]): string[] {
  return handlers.map((h) => {
    const calls = h.effects.map((e) => {
      if (e.kind !== "emit") throw new Error(`printHandlers: unsupported effect kind '${e.kind}'`);
      return printEmitEffect(e);
    });
    return `(${h.on})="${calls.join("; ")}"`;
  });
}

/**
 * `extraAttrsFirst` exists for exactly one caller: `printWhen`, when a
 * `when` wraps a single element (a field's error span) — Angular attaches
 * `*ngIf` as an attribute on that element directly rather than wrapping it,
 * unlike an `instance`, which always gets a real `<ng-container>` wrapper
 * (an element has no separate "outer" tag to wrap with; an instance's own
 * tag already exists to carry other bindings).
 */
function printElement(node: Extract<RenderNode, { kind: "element" }>, extraAttrsFirst: string[] = []): string {
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
  return `<${node.tag} ${attrsStr}>${node.children.map(printInline).join("")}</${node.tag}>`;
}

function printInstance(node: Extract<RenderNode, { kind: "instance" }>): string {
  const selector = `loom-${node.component.name}`;
  const refSlots = node.component.declarations.filter((d) => d.kind === "slot");

  const propAttrs = Object.entries(node.props).map(([k, expr]) => printPropAttr(k, expr, node.name));

  const body: string[] = [];
  for (const slot of refSlots) {
    const fillNodes = node.fills[slot.name];
    if (!fillNodes) continue;
    const inner = fillNodes.map(printInline).join("");
    body.push(slot.name === "default" ? inner : `<div slot="${slot.name}">${inner}</div>`);
  }

  const attrs = [...propAttrs, ...printHandlers(node.handlers)];
  const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `<${selector}${attrsStr}>${body.join("")}</${selector}>`;
}

/**
 * See `printElement`'s doc comment for the element-vs-instance distinction.
 * The generic multi-child `<ng-container>` fallback is defensive — no
 * current example produces a `when` whose `then` isn't a single element or
 * a single instance.
 */
function printWhen(node: Extract<RenderNode, { kind: "when" }>): string {
  const condJs = condToJs(node.cond);
  const only = node.then.length === 1 ? node.then[0]! : undefined;
  if (only?.kind === "instance") return `<ng-container *ngIf="${condJs}">${printInstance(only)}</ng-container>`;
  if (only?.kind === "element") return printElement(only, [`*ngIf="${condJs}"`]);
  return `<ng-container *ngIf="${condJs}">${node.then.map(printInline).join("")}</ng-container>`;
}

/**
 * Prints one lowered composition subtree as Angular template markup. Unlike
 * React, this needs no root/nested distinction — Angular's whole template
 * is always one flat string, so `visibleWhen` (lowered to a root-wrapping
 * `when`) prints through the exact same path as a nested field-error `when`.
 * `slot` doesn't appear in a composition tree (Phase 1b's path is distinct),
 * so it isn't handled here. `fragment` prints as bare concatenation — unlike
 * React, Angular has no fragment-wrapper syntax at all.
 */
function printInline(node: RenderNode): string {
  switch (node.kind) {
    case "text":
      return escapeHtml(String((node.value as Extract<Expr, { type: "literal" }>).value));
    case "fragment":
      return node.children.map(printInline).join("");
    case "when":
      return printWhen(node);
    case "element":
      return printElement(node);
    case "instance":
      return printInstance(node);
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
  const needsEvaluate = fields.length > 0 || hasComputedProps(component.composition);

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
  if (hasMachine) attrs.push(`(click)="dispatch('click')"`);
  // Angular projects by CSS selector against the light DOM, not by prop —
  // a named slot becomes `<ng-content select="[slot=name]">`, matching
  // `<div slot="name">` markup the consumer provides. The selector-less
  // `<ng-content>` for a "default" slot is emitted last so it only picks up
  // whatever the named selectors didn't already claim.
  // Unlike React, `visibleWhen` needs no special casing here: it's lowered
  // into the same `when` node a nested field-error gets, and `printInline`
  // handles both identically (see its doc comment for why that's safe here
  // but not for React).
  const templateBody = rootUses ? printInline(lowerComposition(rootUses, component)) : printRenderNodes(lower(component));
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

  for (const node of component.composition) {
    for (const [propName, value] of Object.entries(node.props ?? {})) {
      if (!isComputedPropValue(value)) continue;
      lines.push(`  get ${computedPropGetterName(node.name, propName)}(): boolean {`);
      lines.push(`    return evaluate(${JSON.stringify(value.expr)}, ${envLiteral(props, fields)}) === true;`);
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
