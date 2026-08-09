import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitReact } from "./emitReact.js";
import { makeFixture, makeStyledFixture, makeCompositionFixture } from "./fixtures.js";

describe("emitReact", () => {
  it("emits one PascalCase-named file per component", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.path).toBe("Checkbox.tsx");
  });

  it("generates a typed props interface from PropNode/EventNode, citing node ids", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain("export interface CheckboxProps {");
    expect(file!.contents).toContain("disabled?: boolean;");
    expect(file!.contents).toContain("checked?: boolean;");
    expect(file!.contents).toContain("onChange?: (payload: { checked: boolean }) => void;");
    expect(file!.contents).toContain("checkbox/declarations/disabled");
  });

  it("adds a children prop for a default slot", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain("children?: React.ReactNode;");
    expect(file!.contents).toContain("{children}");
  });

  it("adds a camelCased named prop (not children) for a non-default slot", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain("helperText?: React.ReactNode;");
    expect(file!.contents).toContain("checkbox/declarations/helper-text");
    expect(file!.contents).toContain('<div data-loom-slot="helper-text">{helperText}</div>');
    // props, then slots, then event callbacks — all destructured together, in that order
    expect(file!.contents).toContain(
      "const { disabled = false, checked = false, children, helperText, onChange } = props;"
    );
  });

  it("skips MethodNode and logs a warning instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [file] = emitReact(makeFixture());
    expect(() => emitReact(makeFixture())).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("checkbox/declarations/focus"));
    expect(file!.contents).not.toContain("focus(");
    warn.mockRestore();
  });

  it("embeds the machine and wires a generic click dispatch", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain("__machine");
    expect(file!.contents).toContain('onClick={() => dispatch("click")}');
    expect(file!.contents).toContain('"id":"unchecked"');
    expect(file!.contents).toContain('id: "toggle-on"');
  });

  it("instantiates a typed LoomMachine, and each Transition/Guard explicitly rather than as nested JSON", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain('import { LoomMachine, Transition, Guard } from "loom-expr";');
    expect(file!.contents).toContain("const __machine = new LoomMachine({");
    expect(file!.contents).toContain("new Transition({");
    expect(file!.contents).toContain("guard: Guard.from({");
    expect(file!.contents).not.toContain("__machine: any");
    expect(file!.contents).toContain("React.useState<string>(__machine.initialState)");
    expect(file!.contents).toContain("const next = __machine.dispatch(state, eventName, env);");
    expect(file!.contents).toContain("if (next) setState(next);");
    // the old inline .find()-over-raw-transitions logic is gone — LoomMachine owns it now
    expect(file!.contents).not.toContain(".find(");
    expect(file!.contents).not.toContain("import { evaluate }");
  });

  it("sets role from the pattern-conformance node and aria-disabled from the disabled prop", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain('role="checkbox"');
    expect(file!.contents).toContain("aria-disabled={disabled}");
  });

  it("the embedded guard actually evaluates correctly through loom-expr (proves the emission is sound)", () => {
    const fixture = makeFixture();
    const guard = fixture.transitions[0]!.guard!;
    expect(evaluate(guard, { disabled: false })).toBe(true);
    expect(evaluate(guard, { disabled: true })).toBe(false);
  });

  it("omits the machine literal and dispatch entirely for a component with no states", () => {
    const fixture = makeFixture();
    fixture.states = [];
    fixture.transitions = [];
    const [file] = emitReact(fixture);
    expect(file!.contents).not.toContain("__machine");
    expect(file!.contents).not.toContain("dispatch");
  });

  it("imports the sibling CSS file and adds className to root and a styled non-default slot", () => {
    const [file] = emitReact(makeStyledFixture());
    expect(file!.contents).toContain('import "./Checkbox.css";');
    expect(file!.contents).toContain('className="loom-checkbox"');
    expect(file!.contents).toContain('<div data-loom-slot="helper-text" className="loom-checkbox__helper-text">{helperText}</div>');
  });

  it("adds neither a CSS import nor a className when the component has no style nodes", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).not.toContain(".css");
    expect(file!.contents).not.toContain("className");
  });
});

describe("emitReact — composition", () => {
  it("imports each distinct referenced component", () => {
    const [file] = emitReact(makeCompositionFixture());
    expect(file!.contents).toContain('import { Dialog } from "./Dialog";');
    expect(file!.contents).toContain('import { Button } from "./Button";');
  });

  it("recursively renders the composition tree: root wrapped in visibleWhen, slot content as attributes, on wired to a callback", () => {
    const [file] = emitReact(makeCompositionFixture());
    expect(file!.contents).toContain("{open && (");
    expect(file!.contents).toContain('<Dialog title={"Confirm Deletion"} actions={<><Button');
    expect(file!.contents).toContain('variant={"primary"}');
    expect(file!.contents).toContain('onPress={() => onClosed?.({})}');
    expect(file!.contents).toContain('{"Confirm"}</Button></>} />');
  });

  it("destructures event callback props so on-wiring and firesWhen can call them", () => {
    const [file] = emitReact(makeCompositionFixture());
    expect(file!.contents).toContain("const { open = false, onOpened, onClosed } = props;");
  });

  it("fires a firesWhen event via a useRef/useEffect pair that skips the initial mount", () => {
    const [file] = emitReact(makeCompositionFixture());
    expect(file!.contents).toContain("const __prevOpen = React.useRef(open);");
    expect(file!.contents).toContain("React.useEffect(() => {");
    expect(file!.contents).toContain("if (__prevOpen.current !== open && open === true) onOpened?.({});");
    expect(file!.contents).toContain("__prevOpen.current = open;");
  });

  it("does not render the per-slot loop when a root composition node is present", () => {
    const [file] = emitReact(makeCompositionFixture());
    expect(file!.contents).not.toContain("data-loom-slot");
  });
});
