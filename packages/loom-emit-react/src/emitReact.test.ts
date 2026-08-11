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

describe("emitReact — each (iteration)", () => {
  it("prints a slot fill as tasks.map((task) => (...)), not a fixed-arity render", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("<List>{tasks.map((task) => (<ListItem");
  });

  it("prints a React key from each.key, as the first attribute on the templated instance", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("<ListItem key={task.id}");
  });

  it("a bool-typed templated prop keeps the historical === true coercion", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain(
      'done={evaluate({"type":"member","target":{"type":"ref","name":"task"},"property":"done"}, { ...__env, task }) === true}'
    );
  });

  it("a non-bool templated prop casts through loomTypeToTs instead of the === true coercion — the first non-bool computed prop this emitter has ever printed", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain(
      '(evaluate({"type":"member","target":{"type":"ref","name":"task"},"property":"label"}, { ...__env, task }) as string)'
    );
  });

  it("merges the bound ident into __env for the templated instance's {expr} props, without touching __env's own construction", () => {
    const [file] = emitReact(makeEachFixture());
    expect(file!.contents).toContain("const __env: any = { tasks };");
    expect(file!.contents).toContain("{ ...__env, task }");
  });

  it("the emitted map callback actually evaluates each item's props correctly (proves the emission is sound)", () => {
    const labelExpr = { type: "member" as const, target: { type: "ref" as const, name: "task" }, property: "label" };
    const doneExpr = { type: "member" as const, target: { type: "ref" as const, name: "task" }, property: "done" };
    const tasks = [
      { id: "a", label: "Buy milk", done: false },
      { id: "b", label: "Walk dog", done: true },
    ];
    const __env = { tasks };
    const rendered = tasks.map((task) => ({
      key: task.id,
      label: evaluate(labelExpr, { ...__env, task }) as string,
      done: evaluate(doneExpr, { ...__env, task }) === true,
    }));
    expect(rendered).toEqual([
      { key: "a", label: "Buy milk", done: false },
      { key: "b", label: "Walk dog", done: true },
    ]);
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

  it("a derived value reaches the resource as list<dataType> via isEmpty, exactly like task-list's tasks prop did for each", () => {
    const [file] = emitReact(makeResourceFixture());
    expect(file!.contents).toContain(
      'const loaded = evaluate({"type":"unop","op":"not","expr":{"type":"builtin","name":"isEmpty","args":[{"type":"ref","name":"profile"}]}}, { profile }) === true;'
    );
  });

  it("the emitted derived value actually evaluates correctly for both the empty and loaded case (proves the emission is sound)", () => {
    const expr = { type: "unop" as const, op: "not" as const, expr: { type: "builtin" as const, name: "isEmpty" as const, args: [{ type: "ref" as const, name: "profile" }] } };
    expect(evaluate(expr, { profile: [] })).toBe(false);
    expect(evaluate(expr, { profile: [{ email: "a@b.co" }] })).toBe(true);
  });
});
