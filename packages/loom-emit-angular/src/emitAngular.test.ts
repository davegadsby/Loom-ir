import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitAngular } from "./emitAngular.js";
import { makeFixture, makeStyledFixture, makeCompositionFixture } from "./fixtures.js";

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
    expect(file!.contents).toContain(`[attr.role]="'checkbox'"`);
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
        '<div slot="actions"><loom-button [variant]="\'primary\'" (press)="closed.emit($event)">Confirm</loom-button></div>' +
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
