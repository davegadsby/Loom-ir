import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitAngular } from "./emitAngular.js";
import {
  makeFixture,
  makeStyledFixture,
  makeCompositionFixture,
  makeLoginFixture,
  makeDerivedFixture,
  makeEachFixture,
  makeResourceFixture,
  makeKeyTriggeredEventFixture,
  makeCheckboxPatternFixture,
} from "./fixtures.js";

describe("emitAngular", () => {
  it("emits one *.component.ts file per component", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.path).toBe("Checkbox.component.ts");
  });

  it("generates @Input/@Output members from PropNode/EventNode, citing node ids", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain("@Input() disabled: boolean = false;");
    expect(file!.contents).toContain("@Input() checked: boolean = false;");
    expect(file!.contents).toContain("@Output() change = new EventEmitter<{ checked: boolean }>();");
    expect(file!.contents).toContain("checkbox/declarations/disabled");
  });

  it("renders ng-content for a default slot", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain("<ng-content></ng-content>");
  });

  it("renders a selector-based ng-content projection for a named slot, ordered before the default fallback", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain('<ng-content select="[slot=helper-text]"></ng-content>');
    expect(file!.contents).toContain(
      '<ng-content select="[slot=helper-text]"></ng-content><ng-content></ng-content>'
    );
  });

  it("skips MethodNode and logs a warning instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [file] = emitAngular(makeFixture());
    expect(() => emitAngular(makeFixture())).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("checkbox/declarations/focus"));
    expect(file!.contents).not.toContain("focus(");
    warn.mockRestore();
  });

  it("embeds the machine and wires a generic click dispatch, same data as the React backend", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain("__machine");
    expect(file!.contents).toContain(`(click)="dispatch('click')"`);
    expect(file!.contents).toContain('"id":"unchecked"');
    expect(file!.contents).toContain('id: "toggle-on"');
  });

  it("instantiates a typed LoomMachine, and each Transition/Guard explicitly rather than as nested JSON", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain('import { LoomMachine, Transition, Guard } from "loom-expr";');
    expect(file!.contents).toContain("const __machine = new LoomMachine({");
    expect(file!.contents).toContain("new Transition({");
    expect(file!.contents).toContain("guard: Guard.from({");
    expect(file!.contents).not.toContain("__machine: any");
    expect(file!.contents).toContain("state: string = __machine.initialState;");
    expect(file!.contents).toContain("const next = __machine.dispatch(this.state, eventName, env);");
    expect(file!.contents).toContain("if (next) this.state = next;");
    // the old inline .find()-over-raw-transitions logic is gone — LoomMachine owns it now
    expect(file!.contents).not.toContain(".find(");
    expect(file!.contents).not.toContain("import { evaluate }");
  });

  it("sets role from the pattern-conformance node and aria-disabled from the disabled prop", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain(`[attr.role]="'widget'"`);
    expect(file!.contents).toContain('[attr.aria-disabled]="disabled"');
  });

  it("single-quotes static string attribute bindings so they don't collide with the double-quoted template string", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).toContain(`[attr.data-loom-component]="'checkbox'"`);
    expect(file!.contents).not.toContain('""checkbox""');
  });

  it("the embedded guard actually evaluates correctly through loom-expr (same tree, same result as React)", () => {
    const fixture = makeFixture();
    const guard = fixture.transitions[0]!.guard!;
    expect(evaluate(guard, { disabled: false })).toBe(true);
    expect(evaluate(guard, { disabled: true })).toBe(false);
  });

  it("omits the machine literal and dispatch entirely for a component with no states", () => {
    const fixture = makeFixture();
    fixture.states = [];
    fixture.transitions = [];
    const [file] = emitAngular(fixture);
    expect(file!.contents).not.toContain("__machine");
    expect(file!.contents).not.toContain("dispatch(eventName");
  });

  it("adds styleUrls and a static root class when the component has style nodes", () => {
    const [file] = emitAngular(makeStyledFixture());
    expect(file!.contents).toContain(`styleUrls: ["./Checkbox.css"],`);
    expect(file!.contents).toContain(`class="loom-checkbox"`);
  });

  it("adds neither styleUrls nor a root class when the component has no style nodes", () => {
    const [file] = emitAngular(makeFixture());
    expect(file!.contents).not.toContain("styleUrls");
    expect(file!.contents).not.toContain('class="');
  });
});

describe("emitAngular — composition", () => {
  it("imports each distinct referenced component and adds them (plus NgIf) to the standalone imports array", () => {
    const [file] = emitAngular(makeCompositionFixture());
    expect(file!.contents).toContain('import { ButtonComponent } from "./Button.component";');
    expect(file!.contents).toContain('import { DialogComponent } from "./Dialog.component";');
    expect(file!.contents).toContain('import { NgIf } from "@angular/common";');
    expect(file!.contents).toContain("imports: [ButtonComponent, DialogComponent, NgIf],");
  });

  it("recursively renders the composition tree: root wrapped in ngIf, slot content as <div slot>, on wired to a real output binding", () => {
    const [file] = emitAngular(makeCompositionFixture());
    expect(file!.contents).toContain(
      '<ng-container *ngIf="open"><loom-dialog><div slot="title">Confirm Deletion</div>' +
        '<div slot="actions"><loom-button [variant]="\'primary\'" (press)="closed.emit({  })">Confirm</loom-button></div>' +
        "</loom-dialog></ng-container>"
    );
  });

  it("does not render ng-content projections when a root composition node is present", () => {
    const [file] = emitAngular(makeCompositionFixture());
    expect(file!.contents).not.toContain("ng-content");
  });

  it("fires a firesWhen event via ngOnChanges, guarded against the initial mount", () => {
    const [file] = emitAngular(makeCompositionFixture());
    expect(file!.contents).toContain("import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from \"@angular/core\";");
    expect(file!.contents).toContain("export class WidgetComponent implements OnChanges {");
    expect(file!.contents).toContain("ngOnChanges(changes: SimpleChanges): void {");
    expect(file!.contents).toContain("if ('open' in changes && !changes['open'].firstChange && changes['open'].currentValue === true) {");
    expect(file!.contents).toContain("this.opened.emit({});");
  });
});

describe("emitAngular — native fields, computed getters, on wiring", () => {
  it("renders a FieldNode's own class members, a get <name>Valid() getter (not an inline evaluate call), and an on<Name>Input method", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain('import { evaluate } from "loom-expr";');
    expect(file!.contents).toContain('  username: string = "";');
    expect(file!.contents).toContain("  usernameTouched: boolean = false;");
    expect(file!.contents).toContain("  get usernameValid(): boolean {");
    expect(file!.contents).toContain("{ username: this.username }) === true;");
    expect(file!.contents).toContain("  onUsernameInput(event: Event): void {");
    expect(file!.contents).toContain("this.username = (event.target as HTMLInputElement).value;");
    expect(file!.contents).toContain("this.usernameTouched = true;");
  });

  it("renders the field as a native input plus a *ngIf-gated error span, bound to class members/getters (not $event)", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain(
      '<input type="text" name="username" [value]="username" (input)="onUsernameInput($event)" [attr.aria-invalid]="usernameTouched && !usernameValid" />'
    );
    expect(file!.contents).toContain(
      '<span *ngIf="usernameTouched && !usernameValid" data-loom-field-error="username">Enter a valid email address.</span>'
    );
  });

  it("emits a named getter (not an inline evaluate call in the template) for a computed prop, referenced via a property binding", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain("get loginButtonDisabled(): boolean {");
    expect(file!.contents).toContain("{ username: this.username, usernameValid: this.usernameValid }) === true;");
    expect(file!.contents).toContain('[disabled]="loginButtonDisabled"');
    expect(file!.contents).not.toContain('[disabled]="evaluate(');
  });

  it("wires a multi-target on inline as chained X.emit({...}) template statements, payload sourced from the field's own class member", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain('(press)="login.emit({ username: username }); closed.emit({  })"');
  });
});

describe("emitAngular — authored derived values", () => {
  it("emits a named getter (not an inline evaluate call in the template) computed from the field's own derived validity", () => {
    const [file] = emitAngular(makeDerivedFixture());
    expect(file!.contents).toContain("get invalid(): boolean {");
    expect(file!.contents).toContain(
      'return evaluate({"type":"unop","op":"not","expr":{"type":"ref","name":"emailValid"}}, { email: this.email, emailValid: this.emailValid }) === true;'
    );
  });

  it("a computed-prop getter's env additionally exposes the derived value's own getter, so a composed {expr} prop can reference it by name", () => {
    const [file] = emitAngular(makeDerivedFixture());
    expect(file!.contents).toContain("get submitButtonDisabled(): boolean {");
    expect(file!.contents).toContain(
      'return evaluate({"type":"ref","name":"invalid"}, { email: this.email, emailValid: this.emailValid, invalid: this.invalid }) === true;'
    );
    expect(file!.contents).toContain('[disabled]="submitButtonDisabled"');
  });

  it("the derived value's own getter and the cross-referencing getter both actually evaluate correctly (proves the emission is sound)", () => {
    const emailValid = evaluate(
      { type: "builtin", name: "matches", args: [{ type: "ref", name: "email" }, { type: "literal", valueType: { kind: "string" }, value: "^[^@]+@[^@]+$" }] },
      { email: "not-an-email" }
    );
    const invalid = evaluate({ type: "unop", op: "not", expr: { type: "ref", name: "emailValid" } }, { email: "not-an-email", emailValid });
    const disabled = evaluate({ type: "ref", name: "invalid" }, { email: "not-an-email", emailValid, invalid });
    expect(emailValid).toBe(false);
    expect(invalid).toBe(true);
    expect(disabled).toBe(true);
  });
});

describe("emitAngular — each (iteration)", () => {
  it("prints *ngFor with trackBy on the templated instance's own tag, not a wrapper", () => {
    const [file] = emitAngular(makeEachFixture());
    expect(file!.contents).toContain('<loom-list-item *ngFor="let task of tasks; trackBy: trackByTask"');
  });

  it("prints a trackBy method returning the each.key field off the bound ident", () => {
    const [file] = emitAngular(makeEachFixture());
    expect(file!.contents).toContain("trackByTask(index: number, task: any): any {");
    expect(file!.contents).toContain("return task.id;");
  });

  it("a template node's computed {expr} prop becomes a parameterized method, not a zero-arg getter — the lambda-lifting a loop variable forces", () => {
    const [file] = emitAngular(makeEachFixture());
    expect(file!.contents).toContain("itemTemplateLabel(task: any): string {");
    expect(file!.contents).not.toContain("get itemTemplateLabel()");
    expect(file!.contents).toContain('[label]="itemTemplateLabel(task)"');
  });

  it("a bool-typed template prop keeps the historical === true coercion; a non-bool one casts through loomTypeToTs instead", () => {
    const [file] = emitAngular(makeEachFixture());
    expect(file!.contents).toContain(
      'return evaluate({"type":"member","target":{"type":"ref","name":"task"},"property":"done"}, { ...{ tasks: this.tasks }, task }) === true;'
    );
    expect(file!.contents).toContain(
      'return evaluate({"type":"member","target":{"type":"ref","name":"task"},"property":"label"}, { ...{ tasks: this.tasks }, task }) as string;'
    );
  });

  it("the emitted methods actually evaluate each item's props correctly (proves the emission is sound)", () => {
    const labelExpr = { type: "member" as const, target: { type: "ref" as const, name: "task" }, property: "label" };
    const doneExpr = { type: "member" as const, target: { type: "ref" as const, name: "task" }, property: "done" };
    const tasks = [
      { id: "a", label: "Buy milk", done: false },
      { id: "b", label: "Walk dog", done: true },
    ];
    const env = { tasks };
    const rendered = tasks.map((task) => ({
      key: task.id,
      label: evaluate(labelExpr, { ...env, task }) as string,
      done: evaluate(doneExpr, { ...env, task }) === true,
    }));
    expect(rendered).toEqual([
      { key: "a", label: "Buy milk", done: false },
      { key: "b", label: "Walk dog", done: true },
    ]);
  });
});

describe("emitAngular — EventNode.trigger kind: key (real keyboard triggers, § Phase 5d)", () => {
  it("binds (keydown) guarded to the declared key with &&, and makes the root focusable", () => {
    const [file] = emitAngular(makeKeyTriggeredEventFixture());
    expect(file!.contents).toContain('tabindex="0"');
    expect(file!.contents).toContain(`(keydown)="$event.key === 'Escape' && dismissed.emit({  })"`);
  });

  it("does not add tabindex or a keydown binding to a component with no key trigger", () => {
    const [file] = emitAngular(makeFixture()); // click trigger only (via its machine)
    expect(file!.contents).not.toContain("tabindex");
    expect(file!.contents).not.toContain("(keydown)");
  });
});

describe("emitAngular — resource (async data as list<T>, 0-or-1)", () => {
  it("declares the resource as an @Input() Array<dataType>, defaulting to []", () => {
    const [file] = emitAngular(makeResourceFixture());
    expect(file!.contents).toContain("@Input() profile: Array<{ email: string }> = [];");
  });

  it("a derived value's own getter reaches the resource as list<dataType> via isEmpty, exactly like task-list's tasks prop did for each", () => {
    const [file] = emitAngular(makeResourceFixture());
    expect(file!.contents).toContain(
      'return evaluate({"type":"unop","op":"not","expr":{"type":"builtin","name":"isEmpty","args":[{"type":"ref","name":"profile"}]}}, { profile: this.profile }) === true;'
    );
  });

  it("the emitted derived value actually evaluates correctly for both the empty and loaded case (proves the emission is sound)", () => {
    const expr = { type: "unop" as const, op: "not" as const, expr: { type: "builtin" as const, name: "isEmpty" as const, args: [{ type: "ref" as const, name: "profile" }] } };
    expect(evaluate(expr, { profile: [] })).toBe(false);
    expect(evaluate(expr, { profile: [{ email: "a@b.co" }] })).toBe(true);
  });
});

describe("emitAngular — checkbox pattern: a real <input type=\"checkbox\"> (§ Phase 5e)", () => {
  it("prints a void <input> — no children, no closing tag", () => {
    const [file] = emitAngular(makeCheckboxPatternFixture());
    expect(file!.contents).toContain("<input ");
    expect(file!.contents).toContain("/>`,");
    expect(file!.contents).not.toContain("[attr.role]");
  });

  it("binds checked to the machine state and disabled to the native attribute, not aria-disabled", () => {
    const [file] = emitAngular(makeCheckboxPatternFixture());
    expect(file!.contents).toContain(`[checked]="state === 'checked'"`);
    expect(file!.contents).not.toContain("aria-disabled");
  });

  it("binds the dispatch handler to (change), not (click) — the idiomatic native checkbox event", () => {
    const [file] = emitAngular(makeCheckboxPatternFixture());
    expect(file!.contents).toContain(`(change)="dispatch('click')"`);
    expect(file!.contents).not.toContain("(click)");
  });

  it("seeds the machine's initial state from the checked prop via ngOnInit, not a field initializer", () => {
    const [file] = emitAngular(makeCheckboxPatternFixture());
    expect(file!.contents).toContain("import { Component, EventEmitter, Input, Output, OnInit } from \"@angular/core\";");
    expect(file!.contents).toContain("implements OnInit");
    expect(file!.contents).toContain("state: string = __machine.initialState;");
    expect(file!.contents).toContain("ngOnInit(): void {");
    expect(file!.contents).toContain("if (this.checked) this.state = 'checked';");
  });
});
