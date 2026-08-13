import { describe, expect, it, vi } from "vitest";
import { evaluate } from "loom-expr";
import { emitReact } from "./emitReact.js";
import {
  makeFixture,
  makeStyledFixture,
  makeCompositionFixture,
  makeLoginFixture,
  makeDerivedFixture,
  makeEachFixture,
  makeTriggeredEventFixture,
  makeKeyTriggeredEventFixture,
  makeResourceFixture,
  makeCheckboxPatternFixture,
  makeSelectionFixture,
  makeCheckedPropFixture,
} from "./fixtures.js";

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
    expect(file!.contents).toContain('onClick={() => { dispatch("click"); }}');
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
    // Seeded from `checked` (§ machineSeedProp — its own name matches a declared state's
    // name), not always `__machine.initialState`: makeFixture()'s `checked` prop is exactly
    // this shape, same as the real checkbox.md spec.
    expect(file!.contents).toContain('React.useState<string>(checked ? "checked" : __machine.initialState)');
    expect(file!.contents).toContain("const next = __machine.dispatch(state, eventName, env);");
    expect(file!.contents).toContain("if (next) setState(next);");
    // the old inline .find()-over-raw-transitions logic is gone — LoomMachine owns it now
    expect(file!.contents).not.toContain(".find(");
    expect(file!.contents).not.toContain("import { evaluate }");
  });

  it("sets role from the pattern-conformance node and aria-disabled from the disabled prop", () => {
    const [file] = emitReact(makeFixture());
    expect(file!.contents).toContain('role="widget"');
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

  it("imports the CSS file from generated/styles/ and adds className to root and a styled non-default slot", () => {
    const [file] = emitReact(makeStyledFixture());
    expect(file!.contents).toContain('import "../styles/Checkbox.css";');
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
  it("renders a FieldNode's local state, change handler, and compiled validity — no evaluate import at all (§ Phase 5f)", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).not.toContain("loom-expr");
    expect(file!.contents).toContain(
      '  const [usernameValue, setUsernameValue] = React.useState<string>("");'
    );
    expect(file!.contents).toContain(
      "  const [usernameTouched, setUsernameTouched] = React.useState<boolean>(false);"
    );
    expect(file!.contents).toContain('const usernameValid = new RegExp("^[^@]+@[^@]+$").test(usernameValue);');
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

  it("compiles a computed prop directly against the field's own local variable — no env object at all", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).not.toContain("__env");
    expect(file!.contents).toContain("<Button disabled={!(usernameValid)}");
  });

  it("wires a multi-target on: both callbacks invoked in one handler, payload sourced from field value", () => {
    const [file] = emitReact(makeLoginFixture());
    expect(file!.contents).toContain(
      "onPress={() => { onLogin?.({ username: usernameValue }); onClosed?.({  }); }}"
    );
  });
});

describe("emitReact — authored derived values", () => {
  it("emits a named const compiled directly from the field's own derived validity — no env object, no evaluate call", () => {
    const [file] = emitReact(makeDerivedFixture());
    expect(file!.contents).toContain("const invalid = !(emailValid);");
    expect(file!.contents).not.toContain("__env");
    expect(file!.contents).not.toContain("loom-expr");
  });

  it("a composed {expr} prop referencing a derived value by name compiles to a bare reference to that derived const, not a repeated expression", () => {
    const [file] = emitReact(makeDerivedFixture());
    expect(file!.contents).toContain("<Button disabled={invalid}");
  });
});

describe("emitReact — each (iteration)", () => {
  it("prints a slot fill as tasks.map((task) => (...)), not a fixed-arity render", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("<List>{tasks.map((task) => (<ListItem");
  });

  it("prints a React key from each.key, as the first attribute on the templated instance", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("<ListItem key={task.id}");
  });

  it("a templated prop's {expr} compiles to a bare member access on the bound ident — no evaluate call, no === true/as T coercion needed for either bool or non-bool", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("done={task.done}");
    expect(file!.contents).toContain("label={task.label}");
    expect(file!.contents).not.toContain("__env");
    expect(file!.contents).not.toContain("loom-expr");
  });
});

describe("emitReact — selection (shared mutual-exclusive state across each siblings)", () => {
  it("emits a useState pair for the declared selection, seeded from initialValue", () => {
    const [file] = emitReact(makeSelectionFixture());
    expect(file!.contents).toContain('const [selected, setSelected] = React.useState<string>("a");');
  });

  it("each templated instance's own checked prop compiles to a comparison against the shared selection, no evaluate call", () => {
    const [file] = emitReact(makeSelectionFixture());
    expect(file!.contents).toContain("checked={(selected === option.value)}");
    expect(file!.contents).not.toContain("evaluate(");
  });

  it("merges the set-cell effect into the same handler as the template's own on-wired emit, in one attribute", () => {
    const [file] = emitReact(makeSelectionFixture());
    const onPressCount = (file!.contents.match(/onPress=/g) ?? []).length;
    expect(onPressCount).toBe(1);
    expect(file!.contents).toContain("onPress={() => { onOptionSelected?.({ value: option.value }); setSelected(option.value); }}");
  });

  it("aria-checked mirrors a declared checked prop on a non-checkbox-pattern root", () => {
    const [file] = emitReact(makeCheckedPropFixture());
    expect(file!.contents).toContain("aria-checked={checked}");
    expect(file!.contents).toContain('role="radio"');
  });
});

describe("emitReact — EventNode.trigger (real triggers, no machine required)", () => {
  it("wires a click handler that fires the triggered event's own callback, with no machine at all", () => {
    const [file] = emitReact(makeTriggeredEventFixture());
    expect(file!.contents).not.toContain("__machine");
    expect(file!.contents).not.toContain("dispatch");
    expect(file!.contents).toContain('onClick={() => { onPress?.({  }); }}');
  });

  it("merges a machine dispatch and a triggered event that share the same DOM trigger into one handler, not two competing attributes", () => {
    const fixture = makeFixture(); // has a machine, trigger { kind: event, name: click }
    fixture.declarations = [
      ...fixture.declarations,
      {
        id: "checkbox/declarations/activated",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "activated",
        payloadType: { kind: "record", fields: {} },
        trigger: { kind: "event", name: "click" },
      },
    ];
    const [file] = emitReact(fixture);
    const onClickCount = (file!.contents.match(/onClick=/g) ?? []).length;
    expect(onClickCount).toBe(1);
    expect(file!.contents).toContain('onClick={() => { dispatch("click"); onActivated?.({  }); }}');
  });
});

describe("emitReact — EventNode.trigger kind: key (real keyboard triggers, § Phase 5d)", () => {
  it("wires an onKeyDown handler guarded to the declared key, and makes the root focusable", () => {
    const [file] = emitReact(makeKeyTriggeredEventFixture());
    expect(file!.contents).toContain("tabIndex={0}");
    expect(file!.contents).toContain('onKeyDown={(e) => { if (e.key === "Escape") { onDismissed?.({  }); } }}');
  });

  it("does not add tabIndex or a keydown handler to a component with no key trigger", () => {
    const [file] = emitReact(makeTriggeredEventFixture()); // click trigger only
    expect(file!.contents).not.toContain("tabIndex");
    expect(file!.contents).not.toContain("onKeyDown");
  });
});

describe("emitReact — resource (async data as list<T>, 0-or-1)", () => {
  it("declares the resource as an Array<dataType> prop, defaulting to []", () => {
    const [file] = emitReact(makeResourceFixture());
    expect(file!.contents).toContain("profile?: Array<{ email: string }>;");
    expect(file!.contents).toContain("const { profile = [] } = props;");
  });

  it("a derived value reaches the resource as list<dataType> via isEmpty, compiled directly — no evaluate call", () => {
    const [file] = emitReact(makeResourceFixture());
    expect(file!.contents).toContain("const loaded = !((profile).length === 0);");
    expect(file!.contents).not.toContain("loom-expr");
  });
});

describe("emitReact — checkbox pattern: a real <input type=\"checkbox\"> (§ Phase 5e)", () => {
  it("prints a void <input> — no children, no closing tag", () => {
    const [file] = emitReact(makeCheckboxPatternFixture());
    expect(file!.contents).toContain("<input");
    expect(file!.contents).toContain("/>");
    expect(file!.contents).not.toContain("</input>");
    expect(file!.contents).not.toContain('role="checkbox"');
  });

  it("binds checked to the machine state and disabled to the native attribute, not aria-disabled", () => {
    const [file] = emitReact(makeCheckboxPatternFixture());
    expect(file!.contents).toContain('checked={state === "checked"}');
    expect(file!.contents).not.toContain("aria-disabled");
  });

  it("binds the dispatch handler to onChange, not onClick — checked is a controlled prop, and React warns without an onChange handler", () => {
    const [file] = emitReact(makeCheckboxPatternFixture());
    expect(file!.contents).toContain('onChange={() => { dispatch("click"); }}');
    expect(file!.contents).not.toContain("onClick");
  });

  it("seeds the machine's initial state from the checked prop, not always the first-declared state", () => {
    const [file] = emitReact(makeCheckboxPatternFixture());
    expect(file!.contents).toContain('React.useState<string>(checked ? "checked" : __machine.initialState)');
  });
});
