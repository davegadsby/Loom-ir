import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitAngular } from "./emitAngular.js";
import { makeFixture } from "./fixtures.js";

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
    expect(file!.contents).toContain('"id":"toggle-on"');
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
});
