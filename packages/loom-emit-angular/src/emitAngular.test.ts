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
  makeSelectionFixture,
  makeCheckedPropFixture,
  makeContentPropFixture,
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

  it("adds styleUrls (from generated/styles/) and a static root class when the component has style nodes", () => {
    const [file] = emitAngular(makeStyledFixture());
    expect(file!.contents).toContain(`styleUrls: ["../styles/Checkbox.css"],`);
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
  it("renders a FieldNode's own class members, a get <name>Valid() getter compiled directly (no evaluate import at all, § Phase 5f), and an on<Name>Input method", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).not.toContain("loom-expr");
    expect(file!.contents).toContain('  username: string = "";');
    expect(file!.contents).toContain("  usernameTouched: boolean = false;");
    expect(file!.contents).toContain("  get usernameValid(): boolean {");
    expect(file!.contents).toContain('return new RegExp("^[^@]+@[^@]+$").test(this.username);');
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

  it("emits a named getter compiled directly against this.usernameValid for a computed prop, referenced via a property binding", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain("get loginButtonDisabled(): boolean {");
    expect(file!.contents).toContain("return !(this.usernameValid);");
    expect(file!.contents).toContain('[disabled]="loginButtonDisabled"');
    expect(file!.contents).not.toContain("evaluate(");
  });

  it("wires a multi-target on inline as chained X.emit({...}) template statements, payload sourced from the field's own class member", () => {
    const [file] = emitAngular(makeLoginFixture());
    expect(file!.contents).toContain('(press)="login.emit({ username: username }); closed.emit({  })"');
  });
});

describe("emitAngular — authored derived values", () => {
  it("emits a named getter compiled directly from the field's own derived validity — no evaluate call", () => {
    const [file] = emitAngular(makeDerivedFixture());
    expect(file!.contents).toContain("get invalid(): boolean {");
    expect(file!.contents).toContain("return !(this.emailValid);");
  });

  it("a computed-prop getter compiles to a bare reference to the derived value's own getter, so a composed {expr} prop can reference it by name", () => {
    const [file] = emitAngular(makeDerivedFixture());
    expect(file!.contents).toContain("get submitButtonDisabled(): boolean {");
    expect(file!.contents).toContain("return this.invalid;");
    expect(file!.contents).toContain('[disabled]="submitButtonDisabled"');
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

  it("a template node's computed {expr} prop compiles to a bare member access on the bound ident — no evaluate call, no === true/as T coercion needed for either bool or non-bool", () => {
    const [file] = emitAngular(makeEachFixture());
    expect(file!.contents).toContain("return task.done;");
    expect(file!.contents).toContain("return task.label;");
    expect(file!.contents).not.toContain("loom-expr");
  });
});

describe("emitAngular — selection (shared mutual-exclusive state across each siblings)", () => {
  it("emits a plain mutable class field for the declared selection, seeded from initialValue", () => {
    const [file] = emitAngular(makeSelectionFixture());
    expect(file!.contents).toContain('selected: string = "a";');
  });

  it("each templated instance's own checked getter compiles to a comparison against the shared selection, no evaluate call", () => {
    const [file] = emitAngular(makeSelectionFixture());
    expect(file!.contents).toContain("optionTemplateChecked(option: any): boolean {");
    expect(file!.contents).toContain("return (this.selected === option.value);");
    expect(file!.contents).not.toContain("evaluate(");
  });

  it("merges the set-cell effect into the same (press) handler as the template's own on-wired emit, via the *ngFor template variable in scope, with no generated method", () => {
    const [file] = emitAngular(makeSelectionFixture());
    const pressAttrCount = (file!.contents.match(/\(press\)=/g) ?? []).length;
    expect(pressAttrCount).toBe(1);
    expect(file!.contents).toContain('(press)="optionSelected.emit({ value: option.value }); selected = option.value"');
  });

  it("[attr.aria-checked] mirrors a declared checked prop on a non-checkbox-pattern root", () => {
    const [file] = emitAngular(makeCheckedPropFixture());
    expect(file!.contents).toContain('[attr.aria-checked]="checked"');
    expect(file!.contents).toContain(`[attr.role]="'radio'"`);
  });
});

describe("emitAngular — content prop (renders a prop as own text content)", () => {
  it("prints a plain {{ label }} interpolation, no ng-content projection", () => {
    const [file] = emitAngular(makeContentPropFixture());
    expect(file!.contents).toContain(">{{ label }}</div>");
    expect(file!.contents).not.toContain("ng-content");
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

  it("a derived value's own getter reaches the resource as list<dataType> via isEmpty, compiled directly — no evaluate call", () => {
    const [file] = emitAngular(makeResourceFixture());
    expect(file!.contents).toContain("return !((this.profile).length === 0);");
    expect(file!.contents).not.toContain("loom-expr");
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
