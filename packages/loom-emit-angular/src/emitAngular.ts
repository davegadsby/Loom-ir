import type { ComponentNode, EmittedFile, EventNode, FieldNode, PropNode, UsesNode } from "loom-ir";
import { partClassName } from "loom-emit-styles";
import {
  capitalize,
  camelCase,
  collectReferencedComponents,
  hasComputedProps,
  isComputedPropValue,
  loomTypeToTs,
  machineLines,
  pascalCase,
} from "loom-emit-core";

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

/**
 * A native `<input>` bound to this field's own class members — `value`/
 * `touched` are set together by the generated `on<Name>Input` method, the
 * derived `<name>Valid` getter is referenced directly (Angular templates
 * can evaluate a class getter but never an imported function), and the
 * invalid message (if any) only shows once the field has been touched,
 * via `*ngIf`.
 */
function renderFieldTemplate(field: FieldNode): string {
  const camel = camelCase(field.name);
  const Camel = capitalize(camel);
  const inputType = field.secret ? "password" : "text";
  const parts = [
    `<input type="${inputType}" name="${field.name}" [value]="${camel}" (input)="on${Camel}Input($event)" [attr.aria-invalid]="${camel}Touched && !${camel}Valid" />`,
  ];
  if (field.invalidMessage) {
    parts.push(
      `<span *ngIf="${camel}Touched && !${camel}Valid" data-loom-field-error="${field.name}">${escapeHtml(field.invalidMessage)}</span>`
    );
  }
  return parts.join("");
}

/**
 * Recursively renders one `UsesNode` (and, through `slotContent.*.uses`/
 * `slotContent.*.fields`, its nested children/native fields) as an Angular
 * template fragment. Unlike React, a resolved child's named slots are
 * `<ng-content select="[slot=name]">` projections against light-DOM markup,
 * so slot content becomes `<div slot="name">...</div>` children — never
 * attributes. A `{ expr }` prop value can't be evaluated inline (Angular
 * templates can't call an imported function), so it binds to a named class
 * getter instead. `on` wiring becomes one or more real Angular output-
 * binding statements targeting the already-generated `@Output()` member(s)
 * on *this* component — bare-string sugar keeps forwarding `$event`
 * untouched (today's only shape, still valid), while an explicit
 * `{ event, payload }` target constructs its payload from sibling field/prop
 * class members (referenced bare, the way any template expression reaches a
 * class member).
 */
function renderUsesTemplate(node: UsesNode, byName: ReadonlyMap<string, UsesNode>, fieldsByName: ReadonlyMap<string, FieldNode>): string {
  const ref = node.resolvedComponent;
  const selector = `loom-${ref.name}`;
  const refSlots = ref.declarations.filter((d) => d.kind === "slot");

  const propAttrs = Object.entries(node.props ?? {}).map(([k, v]) =>
    isComputedPropValue(v) ? `[${k}]="${computedPropGetterName(node.name, k)}"` : angularBinding(k, v)
  );

  const body: string[] = [];
  for (const slot of refSlots) {
    const content = node.slotContent?.[slot.name];
    if (!content) continue;
    const inner =
      "text" in content
        ? escapeHtml(content.text)
        : "uses" in content
          ? content.uses.map((n) => renderUsesTemplate(byName.get(n)!, byName, fieldsByName)).join("")
          : content.fields.map((n) => renderFieldTemplate(fieldsByName.get(n)!)).join("");
    body.push(slot.name === "default" ? inner : `<div slot="${slot.name}">${inner}</div>`);
  }

  const onAttrs = Object.entries(node.on ?? {}).map(([childEventName, wireRaw]) => {
    const wires = Array.isArray(wireRaw) ? wireRaw : [wireRaw];
    const calls = wires.map((w) => {
      if (typeof w === "string") return `${w}.emit($event)`;
      const payloadEntries = Object.entries(w.payload ?? {}).map(([k, source]) => `${k}: ${source}`);
      return `${w.event}.emit({ ${payloadEntries.join(", ")} })`;
    });
    return `(${childEventName})="${calls.join("; ")}"`;
  });

  const attrs = [...propAttrs, ...onAttrs];
  const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `<${selector}${attrsStr}>${body.join("")}</${selector}>`;
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
  const fieldsByName = new Map(fields.map((f) => [f.name, f] as const));
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
  let templateBody: string;
  if (rootUses) {
    const byName = new Map(component.composition.map((n) => [n.name, n] as const));
    const composed = renderUsesTemplate(rootUses, byName, fieldsByName);
    templateBody = rootUses.visibleWhen ? `<ng-container *ngIf="${rootUses.visibleWhen}">${composed}</ng-container>` : composed;
  } else {
    const namedSlots = slots.filter((s) => s.name !== "default");
    const defaultSlot = slots.find((s) => s.name === "default");
    templateBody = [
      ...namedSlots.map((slot) => `<ng-content select="[slot=${slot.name}]"></ng-content>`),
      ...(defaultSlot ? ["<ng-content></ng-content>"] : []),
    ].join("");
  }
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
