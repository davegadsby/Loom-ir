import { describe, expect, it } from "vitest";
import { checkComposition, CompositionCheckError } from "./composition.js";
import type { ComponentNode, PropNode, EventNode, SlotNode, UsesNode, FieldNode, DerivedNode } from "./nodes.js";

function makeChildComponent(overrides: Partial<ComponentNode> = {}): ComponentNode {
  return {
    id: "child",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "child",
    extends: [],
    declarations: [],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [],
    a11y: [],
    style: [],
    composition: [],
    prose: [],
    ...overrides,
  };
}

const childProp: PropNode = {
  id: "child/declarations/variant",
  kind: "prop",
  origin: "own",
  assertable: false,
  name: "variant",
  valueType: { kind: "string" },
};

const childSlot: SlotNode = {
  id: "child/declarations/default",
  kind: "slot",
  origin: "own",
  assertable: false,
  name: "default",
};

const childEvent: EventNode = {
  id: "child/declarations/press",
  kind: "event",
  origin: "own",
  assertable: false,
  name: "press",
  payloadType: { kind: "record", fields: {} },
};

const child = makeChildComponent({ declarations: [childProp, childSlot, childEvent] });

function makeUses(overrides: Partial<UsesNode>): UsesNode {
  return {
    id: "widget/composition/instance",
    kind: "uses",
    origin: "own",
    assertable: false,
    name: "instance",
    component: "child",
    resolvedComponent: child,
    ...overrides,
  };
}

function makeWidget(overrides: Partial<ComponentNode> = {}): ComponentNode {
  return {
    id: "widget",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "widget",
    extends: [],
    declarations: [],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [],
    a11y: [],
    style: [],
    composition: [],
    prose: [],
    ...overrides,
  };
}

describe("checkComposition", () => {
  it("does nothing when there is no composition section", () => {
    expect(() => checkComposition(makeWidget())).not.toThrow();
  });

  it("accepts a single root node with no claims", () => {
    const widget = makeWidget({ composition: [makeUses({ root: true })] });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when there is no root node", () => {
    const widget = makeWidget({ composition: [makeUses({ name: "instance" })] });
    expect(() => checkComposition(widget)).toThrow(CompositionCheckError);
    expect(() => checkComposition(widget)).toThrow(/0 root composition nodes/);
  });

  it("throws when there is more than one root node", () => {
    const widget = makeWidget({
      composition: [makeUses({ name: "a", root: true }), makeUses({ name: "b", root: true })],
    });
    expect(() => checkComposition(widget)).toThrow(/2 root composition nodes/);
  });

  it("throws on an orphaned node (not root, not claimed by any slotContent)", () => {
    const widget = makeWidget({
      composition: [makeUses({ name: "root-node", root: true }), makeUses({ name: "orphan" })],
    });
    expect(() => checkComposition(widget)).toThrow(/is orphaned/);
  });

  it("throws when a node references an unknown sibling name", () => {
    const widget = makeWidget({
      composition: [
        makeUses({ name: "root-node", root: true, slotContent: { default: { uses: ["missing"] } } }),
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/unknown composition node 'missing'/);
  });

  it("throws when a node is claimed by more than one parent", () => {
    const widget = makeWidget({
      composition: [
        makeUses({ name: "root-node", root: true, slotContent: { default: { uses: ["leaf"] }, other: { uses: ["leaf"] } } }),
        makeUses({ name: "leaf" }),
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/claimed by more than one parent/);
  });

  it("throws on a cycle", () => {
    const widget = makeWidget({
      composition: [
        makeUses({ name: "a", root: true, slotContent: { default: { uses: ["b"] } } }),
        makeUses({ name: "b", slotContent: { default: { uses: ["a"] } } }),
      ],
    });
    // 'a' claims 'b' and 'b' claims 'a' back — 'a' ends up claimed by 'b', so root-claimed-by-another fires first.
    expect(() => checkComposition(widget)).toThrow(CompositionCheckError);
  });

  it("throws when a prop key isn't declared on the referenced component", () => {
    const widget = makeWidget({
      composition: [makeUses({ root: true, props: { nonexistent: "x" } })],
    });
    expect(() => checkComposition(widget)).toThrow(/sets prop 'nonexistent'/);
  });

  it("throws when a slotContent key isn't declared on the referenced component", () => {
    const widget = makeWidget({
      composition: [makeUses({ root: true, slotContent: { nonexistent: { text: "hi" } } })],
    });
    expect(() => checkComposition(widget)).toThrow(/fills slot 'nonexistent'/);
  });

  it("throws when an 'on' key isn't a declared event on the referenced child", () => {
    const widget = makeWidget({
      declarations: [{ id: "widget/declarations/closed", kind: "event", origin: "own", assertable: false, name: "closed", payloadType: { kind: "record", fields: {} } }],
      composition: [makeUses({ root: true, on: { nonexistent: "closed" } })],
    });
    expect(() => checkComposition(widget)).toThrow(/wires event 'nonexistent'/);
  });

  it("throws when an 'on' value isn't a declared event on this component", () => {
    const widget = makeWidget({
      composition: [makeUses({ root: true, on: { press: "nonexistent" } })],
    });
    expect(() => checkComposition(widget)).toThrow(/does not declare/);
  });

  it("accepts a valid 'on' wiring", () => {
    const widget = makeWidget({
      declarations: [{ id: "widget/declarations/closed", kind: "event", origin: "own", assertable: false, name: "closed", payloadType: { kind: "record", fields: {} } }],
      composition: [makeUses({ root: true, on: { press: "closed" } })],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when visibleWhen is set on a non-root node", () => {
    const widget = makeWidget({
      declarations: [{ id: "widget/declarations/open", kind: "prop", origin: "own", assertable: false, name: "open", valueType: { kind: "bool" } }],
      composition: [
        makeUses({ name: "root-node", root: true, slotContent: { default: { uses: ["leaf"] } } }),
        makeUses({ name: "leaf", visibleWhen: "open" }),
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/sets visibleWhen but is not the root node/);
  });

  it("throws when visibleWhen names a prop that isn't a declared bool prop", () => {
    const widget = makeWidget({ composition: [makeUses({ root: true, visibleWhen: "open" })] });
    expect(() => checkComposition(widget)).toThrow(/not a declared bool prop/);
  });

  it("accepts a valid visibleWhen on the root node", () => {
    const widget = makeWidget({
      declarations: [{ id: "widget/declarations/open", kind: "prop", origin: "own", assertable: false, name: "open", valueType: { kind: "bool" } }],
      composition: [makeUses({ root: true, visibleWhen: "open" })],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when EventNode.firesWhen.prop isn't a declared prop, even with no composition section", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/opened", kind: "event", origin: "own", assertable: false, name: "opened", payloadType: { kind: "record", fields: {} }, firesWhen: { prop: "missing", becomes: true } },
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/firesWhen.prop 'missing'/);
  });

  it("accepts a valid firesWhen", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/open", kind: "prop", origin: "own", assertable: false, name: "open", valueType: { kind: "bool" } },
        { id: "widget/declarations/opened", kind: "event", origin: "own", assertable: false, name: "opened", payloadType: { kind: "record", fields: {} }, firesWhen: { prop: "open", becomes: true } },
      ],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  const username: FieldNode = {
    id: "widget/declarations/username",
    kind: "field",
    origin: "own",
    assertable: false,
    name: "username",
  };

  it("accepts a field with no validate expression", () => {
    const widget = makeWidget({ declarations: [username] });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("accepts a field whose validate expression evaluates to bool", () => {
    const withValidate: FieldNode = { ...username, validate: { type: "literal", valueType: { kind: "bool" }, value: true } };
    const widget = makeWidget({ declarations: [withValidate] });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when a field's validate expression doesn't evaluate to bool", () => {
    const withValidate: FieldNode = { ...username, validate: { type: "literal", valueType: { kind: "string" }, value: "x" } };
    const widget = makeWidget({ declarations: [withValidate] });
    expect(() => checkComposition(widget)).toThrow(/validate must evaluate to bool/);
  });

  it("throws when a field's validate expression is malformed", () => {
    const withValidate: FieldNode = {
      ...username,
      validate: { type: "member", target: { type: "ref", name: "missing" }, property: "x" },
    };
    const widget = makeWidget({ declarations: [withValidate] });
    expect(() => checkComposition(widget)).toThrow(/has an invalid validate expression/);
  });

  it("throws when slotContent.fields references a field this component doesn't declare", () => {
    const widget = makeWidget({
      declarations: [username],
      composition: [makeUses({ root: true, slotContent: { default: { fields: ["missing"] } } })],
    });
    expect(() => checkComposition(widget)).toThrow(/references unknown field 'missing'/);
  });

  it("accepts slotContent.fields referencing a declared field", () => {
    const widget = makeWidget({
      declarations: [username],
      composition: [makeUses({ root: true, slotContent: { default: { fields: ["username"] } } })],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  const childBool = makeChildComponent({
    id: "toggle",
    name: "toggle",
    declarations: [
      { id: "toggle/declarations/disabled", kind: "prop", origin: "own", assertable: false, name: "disabled", valueType: { kind: "bool" } },
    ],
  });
  function makeBoolUses(overrides: Partial<UsesNode>): UsesNode {
    return {
      id: "widget/composition/toggle-instance",
      kind: "uses",
      origin: "own",
      assertable: false,
      name: "toggle-instance",
      component: "toggle",
      resolvedComponent: childBool,
      ...overrides,
    };
  }

  it("accepts a valid computed {expr} prop referencing a field's derived <name>Valid", () => {
    const widget = makeWidget({
      declarations: [username],
      composition: [
        makeBoolUses({ root: true, props: { disabled: { expr: { type: "ref", name: "usernameValid" } } } }),
      ],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when a computed {expr} prop references an unknown name", () => {
    const widget = makeWidget({
      declarations: [username],
      composition: [
        makeBoolUses({ root: true, props: { disabled: { expr: { type: "ref", name: "userValid" } } } }),
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/invalid computed expression/);
  });

  it("throws when a computed {expr} prop's type doesn't match the referenced prop's declared type", () => {
    const widget = makeWidget({
      declarations: [username],
      composition: [
        makeBoolUses({ root: true, props: { disabled: { expr: { type: "ref", name: "username" } } } }),
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/computed expression has type 'string', expected 'bool'/);
  });

  const closedEvent: EventNode = {
    id: "widget/declarations/closed",
    kind: "event",
    origin: "own",
    assertable: false,
    name: "closed",
    payloadType: { kind: "record", fields: {} },
  };
  const loginEvent: EventNode = {
    id: "widget/declarations/login",
    kind: "event",
    origin: "own",
    assertable: false,
    name: "login",
    payloadType: { kind: "record", fields: { username: { kind: "string" } } },
  };

  it("accepts a multi-target 'on' wire with a correctly-populated payload", () => {
    const widget = makeWidget({
      declarations: [username, closedEvent, loginEvent],
      composition: [
        makeUses({
          root: true,
          on: { press: [{ event: "login", payload: { username: "username" } }, { event: "closed" }] },
        }),
      ],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when a multi-target 'on' wire is missing a required payload field", () => {
    const widget = makeWidget({
      declarations: [username, loginEvent],
      composition: [makeUses({ root: true, on: { press: { event: "login" } } })],
    });
    expect(() => checkComposition(widget)).toThrow(/missing required field 'username'/);
  });

  it("throws when a multi-target 'on' wire's payload has a key not in the event's payloadType", () => {
    const widget = makeWidget({
      declarations: [username, closedEvent],
      composition: [makeUses({ root: true, on: { press: { event: "closed", payload: { bogus: "username" } } } })],
    });
    expect(() => checkComposition(widget)).toThrow(/payload key 'bogus' not in 'closed''s declared payloadType/);
  });

  it("throws when a multi-target 'on' wire's payload source is neither a declared field nor a declared prop", () => {
    const widget = makeWidget({
      declarations: [loginEvent],
      composition: [makeUses({ root: true, on: { press: { event: "login", payload: { username: "nonexistent" } } } })],
    });
    expect(() => checkComposition(widget)).toThrow(/payload source 'nonexistent' is neither a declared field nor a declared prop/);
  });

  it("still accepts the original bare-string 'on' sugar (backward compatible)", () => {
    const widget = makeWidget({
      declarations: [closedEvent],
      composition: [makeUses({ root: true, on: { press: "closed" } })],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  describe("derived", () => {
    it("accepts a derived value whose expression's type matches its declared type", () => {
      const submitDisabled: DerivedNode = {
        id: "widget/declarations/submit-disabled",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "submit-disabled",
        valueType: { kind: "bool" },
        expr: { type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } },
      };
      const widget = makeWidget({ declarations: [username, submitDisabled] });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("throws when a derived expression is malformed", () => {
      const bad: DerivedNode = {
        id: "widget/declarations/bad",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "bad",
        valueType: { kind: "bool" },
        expr: { type: "ref", name: "nonexistent" },
      };
      const widget = makeWidget({ declarations: [bad] });
      expect(() => checkComposition(widget)).toThrow(/invalid expression/);
    });

    it("throws when a derived expression's type doesn't match its declared type", () => {
      const wrongType: DerivedNode = {
        id: "widget/declarations/wrong-type",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "wrong-type",
        valueType: { kind: "string" },
        expr: { type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } },
      };
      const widget = makeWidget({ declarations: [username, wrongType] });
      expect(() => checkComposition(widget)).toThrow(/declared type 'string' does not match its expression's type 'bool'/);
    });

    it("can reference own props alongside a field's derived <name>Valid", () => {
      const disabledProp: PropNode = {
        id: "widget/declarations/disabled",
        kind: "prop",
        origin: "own",
        assertable: false,
        name: "disabled",
        valueType: { kind: "bool" },
      };
      const submitDisabled: DerivedNode = {
        id: "widget/declarations/submit-disabled",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "submit-disabled",
        valueType: { kind: "bool" },
        expr: {
          type: "binop",
          op: "or",
          left: { type: "ref", name: "disabled" },
          right: { type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } },
        },
      };
      const widget = makeWidget({ declarations: [disabledProp, username, submitDisabled] });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("lets a composed {expr} prop reference a declared derived value by name", () => {
      const submitDisabled: DerivedNode = {
        id: "widget/declarations/submit-disabled",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "submit-disabled",
        valueType: { kind: "bool" },
        expr: { type: "unop", op: "not", expr: { type: "ref", name: "usernameValid" } },
      };
      const widget = makeWidget({
        declarations: [username, submitDisabled],
        composition: [makeBoolUses({ root: true, props: { disabled: { expr: { type: "ref", name: "submit-disabled" } } } })],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("does not let a composed {expr} prop reference another derived value's own name from within a derived expression", () => {
      // i.e. one DerivedNode's expr can't reference a sibling DerivedNode — confirmed by the
      // "invalid expression" case above using an entirely unrelated field; this test instead
      // confirms a real cross-derived reference is rejected the same way, not silently accepted.
      const a: DerivedNode = {
        id: "widget/declarations/a",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "a",
        valueType: { kind: "bool" },
        expr: { type: "literal", valueType: { kind: "bool" }, value: true },
      };
      const b: DerivedNode = {
        id: "widget/declarations/b",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "b",
        valueType: { kind: "bool" },
        expr: { type: "ref", name: "a" },
      };
      const widget = makeWidget({ declarations: [a, b] });
      expect(() => checkComposition(widget)).toThrow(/invalid expression/);
    });
  });
});
