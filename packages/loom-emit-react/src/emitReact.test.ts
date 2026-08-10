import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitReact } from "./emitReact.js";
import { makeFixture, makeStyledFixture, makeCompositionFixture, makeLoginFixture, makeDerivedFixture } from "./fixtures.js";

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
    expect(file!.contents).toContain('onPress={() => { onClosed?.({  }); }}');
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

describe("emitReact — native fields, computed props, multi-target on", () => {
  it("renders a FieldNode's local state, change handler, and live-evaluated validity", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).toContain('import { evaluate } from "loom-expr";');
    expect(file!.contents).toContain(
      '  const [usernameValue, setUsernameValue] = React.useState<string>("");'
    );
    expect(file!.contents).toContain(
      "  const [usernameTouched, setUsernameTouched] = React.useState<boolean>(false);"
    );
    expect(file!.contents).toContain("const usernameValid = evaluate(");
    expect(file!.contents).toContain('{ username: usernameValue }) === true;');
    expect(file!.contents).toContain("const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {");
    expect(file!.contents).toContain("setUsernameValue(e.target.value);");
    expect(file!.contents).toContain("setUsernameTouched(true);");
  });

  it("renders the field as a native input plus a conditional error message gated on touched && !valid", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).toContain(
      '<input type="text" name="username" value={usernameValue} onChange={handleUsernameChange} aria-invalid={usernameTouched && !usernameValid} />'
    );
    expect(file!.contents).toContain(
      '{usernameTouched && !usernameValid && <span data-loom-field-error="username">{"Enter a valid email address."}</span>}'
    );
  });

  it("builds __env from own props and derived field validity, and evaluates a computed prop against it", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).toContain(
      "  const __env: any = { username: usernameValue, usernameValid: usernameValid };"
    );
    expect(file!.contents).toContain("<Button disabled={evaluate(");
    expect(file!.contents).toContain(", __env) === true}");
  });

  it("wires a multi-target on: both callbacks invoked in one handler, payload sourced from field value", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).toContain(
      "onPress={() => { onLogin?.({ username: usernameValue }); onClosed?.({  }); }}"
    );
  });
});

describe("emitReact — authored derived values", () => {
  it("emits a named const computed from the field's own derived validity, using its own inline env (not __env)", () => {
    const [file] = emitReact(makeDerivedFixture());
    expect(file!.contents).toContain(
      'const invalid = evaluate({"type":"unop","op":"not","expr":{"type":"ref","name":"emailValid"}}, { email: emailValue, emailValid: emailValid }) === true;'
    );
  });

  it("exposes the derived value's name in __env so a composed prop can reference it", () => {
    const [file] = emitReact(makeDerivedFixture());
    expect(file!.contents).toContain("const __env: any = { email: emailValue, emailValid: emailValid, invalid: invalid };");
  });

  it("a composed {expr} prop referencing a derived value by name evaluates a bare ref against __env, not a repeated expression", () => {
    const [file] = emitReact(makeDerivedFixture());
    expect(file!.contents).toContain('disabled={evaluate({"type":"ref","name":"invalid"}, __env) === true}');
  });

  it("the emitted derived value and the __env cross-reference both actually evaluate correctly (proves the emission is sound)", () => {
    const emailValue = "not-an-email";
    const emailValid = evaluate(
      { type: "builtin", name: "matches", args: [{ type: "ref", name: "email" }, { type: "literal", valueType: { kind: "string" }, value: "^[^@]+@[^@]+$" }] },
      { email: emailValue }
    );
    const invalid = evaluate({ type: "unop", op: "not", expr: { type: "ref", name: "emailValid" } }, { email: emailValue, emailValid });
    const __env = { email: emailValue, emailValid, invalid };
    const disabled = evaluate({ type: "ref", name: "invalid" }, __env);
    expect(emailValid).toBe(false);
    expect(invalid).toBe(true);
    expect(disabled).toBe(true);
  });
});
