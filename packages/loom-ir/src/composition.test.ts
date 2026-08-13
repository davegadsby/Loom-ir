import { describe, expect, it } from "vitest";
import type { LoomType } from "loom-expr";
import { checkComposition, CompositionCheckError } from "./composition.js";
import type { ComponentNode, PropNode, EventNode, SlotNode, UsesNode, FieldNode, DerivedNode, ResourceNode, SelectionNode } from "./nodes.js";

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

  it("accepts a declared event with a trigger and an empty payloadType", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/press", kind: "event", origin: "own", assertable: false, name: "press", payloadType: { kind: "record", fields: {} }, trigger: { kind: "event", name: "click" } },
      ],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when a triggered event's payloadType is not record{}", () => {
    const widget = makeWidget({
      declarations: [
        {
          id: "widget/declarations/press",
          kind: "event",
          origin: "own",
          assertable: false,
          name: "press",
          payloadType: { kind: "record", fields: { x: { kind: "string" } } },
          trigger: { kind: "event", name: "click" },
        },
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/trigger but its payloadType is not 'record{}'/);
  });

  it("throws when a triggered event's payloadType is a non-record type", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/press", kind: "event", origin: "own", assertable: false, name: "press", payloadType: { kind: "string" }, trigger: { kind: "event", name: "click" } },
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/trigger but its payloadType is not 'record{}'/);
  });

  it("accepts a declared event with a kind:key trigger", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/dismissed", kind: "event", origin: "own", assertable: false, name: "dismissed", payloadType: { kind: "record", fields: {} }, trigger: { kind: "key", key: "Escape" } },
      ],
    });
    expect(() => checkComposition(widget)).not.toThrow();
  });

  it("throws when two declared events wire a keydown trigger to two different keys — both backends can only bind one keydown handler on the root", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/dismissed", kind: "event", origin: "own", assertable: false, name: "dismissed", payloadType: { kind: "record", fields: {} }, trigger: { kind: "key", key: "Escape" } },
        { id: "widget/declarations/confirmed", kind: "event", origin: "own", assertable: false, name: "confirmed", payloadType: { kind: "record", fields: {} }, trigger: { kind: "key", key: "Enter" } },
      ],
    });
    expect(() => checkComposition(widget)).toThrow(/more than one distinct keyboard trigger key/);
  });

  it("allows two declared events to share the exact same keydown trigger key (they merge into one handler)", () => {
    const widget = makeWidget({
      declarations: [
        { id: "widget/declarations/dismissed", kind: "event", origin: "own", assertable: false, name: "dismissed", payloadType: { kind: "record", fields: {} }, trigger: { kind: "key", key: "Escape" } },
        { id: "widget/declarations/cancelled", kind: "event", origin: "own", assertable: false, name: "cancelled", payloadType: { kind: "record", fields: {} }, trigger: { kind: "key", key: "Escape" } },
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

  describe("each", () => {
    const itemType: LoomType = { kind: "record", fields: { id: { kind: "string" }, label: { kind: "string" } } };
    const itemsProp: PropNode = {
      id: "widget/declarations/items",
      kind: "prop",
      origin: "own",
      assertable: false,
      name: "items",
      valueType: { kind: "list", of: itemType },
      defaultValue: [],
    };
    const itemChild = makeChildComponent({
      id: "item",
      name: "item",
      declarations: [
        { id: "item/declarations/label", kind: "prop", origin: "own", assertable: false, name: "label", valueType: { kind: "string" } },
        { id: "item/declarations/default", kind: "slot", origin: "own", assertable: false, name: "default" },
      ],
    });
    function makeItemUses(overrides: Partial<UsesNode>): UsesNode {
      return {
        id: "widget/composition/item-template",
        kind: "uses",
        origin: "own",
        assertable: false,
        name: "item-template",
        component: "item",
        resolvedComponent: itemChild,
        ...overrides,
      };
    }
    const itemLabelExpr = { type: "member", target: { type: "ref", name: "item" }, property: "label" } as const;

    it("accepts a valid each: iterates a declared list prop, instantiating its template with the bound ident in scope", () => {
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "item-template", key: "id" } } } }),
          makeItemUses({ props: { label: { expr: itemLabelExpr } } }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("throws when each.over is not a declared prop", () => {
      const widget = makeWidget({
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "missing", as: "item", use: "item-template" } } } }),
          makeItemUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each.over 'missing' is not a declared prop/);
    });

    it("throws when each.over is not a list-typed prop", () => {
      const notAList: PropNode = { ...itemsProp, name: "count", valueType: { kind: "int" }, defaultValue: 0 };
      const widget = makeWidget({
        declarations: [notAList],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "count", as: "item", use: "item-template" } } } }),
          makeItemUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/must be a list-typed prop/);
    });

    it("throws when each.use references an unknown composition node (caught by the same structural 'unknown composition node' check 'uses' gets)", () => {
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "missing" } } } })],
      });
      expect(() => checkComposition(widget)).toThrow(/references unknown composition node 'missing'/);
    });

    it("throws when each.key is not a field of the item's record type", () => {
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "item-template", key: "missing" } } } }),
          makeItemUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each.key 'missing' is not a field/);
    });

    it("claims each.use's node the same way a plain 'uses' entry does — claimed twice throws, unclaimed (orphaned) throws", () => {
      const claimedTwice = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({
            root: true,
            slotContent: { default: { each: { over: "items", as: "item", use: "item-template" } }, other: { uses: ["item-template"] } },
          }),
          makeItemUses({}),
        ],
      });
      expect(() => checkComposition(claimedTwice)).toThrow(/claimed by more than one parent/);

      const orphaned = makeWidget({
        declarations: [itemsProp],
        composition: [makeUses({ root: true }), makeItemUses({})],
      });
      expect(() => checkComposition(orphaned)).toThrow(/is orphaned/);
    });

    it("lets the template node's {expr} props reference the bound ident, typed as the list's element type", () => {
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "item-template" } } } }),
          makeItemUses({ props: { label: { expr: itemLabelExpr } } }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("rejects a template {expr} prop whose type doesn't match, same as any other computed prop", () => {
      const wrongType = { type: "literal", valueType: { kind: "bool" }, value: true } as const;
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "item-template" } } } }),
          makeItemUses({ props: { label: { expr: wrongType } } }),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/computed expression has type 'bool', expected 'string'/);
    });

    it("does NOT let the bound ident leak into a node that isn't the each's own template — e.g. one nested a level deeper, inside the template's own slot", () => {
      const widget = makeWidget({
        declarations: [itemsProp],
        composition: [
          makeUses({ root: true, slotContent: { default: { each: { over: "items", as: "item", use: "item-template" } } } }),
          makeItemUses({ slotContent: { default: { uses: ["unrelated"] } } }),
          makeBoolUses({ name: "unrelated", props: { disabled: { expr: itemLabelExpr } } }),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/invalid computed expression/);
    });
  });

  describe("selection + each.selects", () => {
    const selectableItemType: LoomType = { kind: "record", fields: { value: { kind: "string" }, label: { kind: "string" } } };
    const optionsProp: PropNode = {
      id: "widget/declarations/options",
      kind: "prop",
      origin: "own",
      assertable: false,
      name: "options",
      valueType: { kind: "list", of: selectableItemType },
      defaultValue: [],
    };
    const selected: SelectionNode = {
      id: "widget/declarations/selected",
      kind: "selection",
      origin: "own",
      assertable: false,
      name: "selected",
      valueType: { kind: "string" },
      initialValue: "a",
    };
    const selectableChild = makeChildComponent({
      id: "option",
      name: "option",
      declarations: [
        { id: "option/declarations/value", kind: "prop", origin: "own", assertable: false, name: "value", valueType: { kind: "string" } },
        { id: "option/declarations/checked", kind: "prop", origin: "own", assertable: false, name: "checked", valueType: { kind: "bool" } },
        {
          id: "option/declarations/press",
          kind: "event",
          origin: "own",
          assertable: false,
          name: "press",
          payloadType: { kind: "record", fields: {} },
        },
      ],
    });
    function makeOptionUses(overrides: Partial<UsesNode>): UsesNode {
      return {
        id: "widget/composition/option-template",
        kind: "uses",
        origin: "own",
        assertable: false,
        name: "option-template",
        component: "option",
        resolvedComponent: selectableChild,
        ...overrides,
      };
    }
    const optionValueExpr = { type: "member", target: { type: "ref", name: "option" }, property: "value" } as const;

    it("rejects a selection whose valueType is not a primitive/enum", () => {
      const recordSelection: SelectionNode = { ...selected, valueType: { kind: "record", fields: {} } };
      const widget = makeWidget({ declarations: [recordSelection] });
      expect(() => checkComposition(widget)).toThrow(/selections are restricted to bool\/int\/float\/string\/enum/);
    });

    it("accepts a valid each.selects: wires a template event to set a sibling selection from a bound item field", () => {
      const widget = makeWidget({
        declarations: [optionsProp, selected],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "selected", field: "value" } } },
            },
          }),
          makeOptionUses({ props: { value: { expr: optionValueExpr } } }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("lets a composed {expr} prop reference the selection by name, alongside the each's own bound ident", () => {
      const checkedExpr = { type: "binop", op: "==", left: { type: "ref", name: "selected" }, right: optionValueExpr } as const;
      const widget = makeWidget({
        declarations: [optionsProp, selected],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "selected", field: "value" } } },
            },
          }),
          makeOptionUses({ props: { value: { expr: optionValueExpr }, checked: { expr: checkedExpr } } }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("throws when each.selects.selection is not a declared selection", () => {
      const widget = makeWidget({
        declarations: [optionsProp],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "missing", field: "value" } } },
            },
          }),
          makeOptionUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each.selects.selection 'missing' is not a declared selection/);
    });

    it("throws when each.selects.field is not a field of the item's record type", () => {
      const widget = makeWidget({
        declarations: [optionsProp, selected],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "selected", field: "missing" } } },
            },
          }),
          makeOptionUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each.selects.field 'missing' is not a field/);
    });

    it("throws when each.selects.field's type doesn't match the selection's own valueType", () => {
      const boolSelection: SelectionNode = { ...selected, valueType: { kind: "bool" } };
      const widget = makeWidget({
        declarations: [optionsProp, boolSelection],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "press", selection: "selected", field: "value" } } },
            },
          }),
          makeOptionUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/does not match selection 'selected''s type/);
    });

    it("throws when each.selects.on is not a declared event on the template's own referenced component", () => {
      const widget = makeWidget({
        declarations: [optionsProp, selected],
        composition: [
          makeUses({
            root: true,
            slotContent: {
              default: { each: { over: "options", as: "option", use: "option-template", selects: { on: "missing", selection: "selected", field: "value" } } },
            },
          }),
          makeOptionUses({}),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each.selects.on 'missing' is not a declared event/);
    });

    it("accepts an 'on' payload sourced from a dotted <as>.<field> reference into the each's own bound item", () => {
      const pressEvent: EventNode = {
        id: "widget/declarations/option-pressed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "option-pressed",
        payloadType: { kind: "record", fields: { value: { kind: "string" } } },
      };
      const widget = makeWidget({
        declarations: [optionsProp, pressEvent],
        composition: [
          makeUses({
            root: true,
            slotContent: { default: { each: { over: "options", as: "option", use: "option-template" } } },
          }),
          makeOptionUses({ on: { press: { event: "option-pressed", payload: { value: "option.value" } } } }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("throws when a dotted 'on' payload source's ident isn't the each this node is itself the template for", () => {
      const pressEvent: EventNode = {
        id: "widget/declarations/option-pressed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "option-pressed",
        payloadType: { kind: "record", fields: { value: { kind: "string" } } },
      };
      const widget = makeWidget({
        declarations: [optionsProp, pressEvent],
        composition: [
          makeUses({
            root: true,
            slotContent: { default: { each: { over: "options", as: "option", use: "option-template" } } },
          }),
          makeOptionUses({ on: { press: { event: "option-pressed", payload: { value: "wrong.value" } } } }),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/each-bound ident 'wrong' that is not in scope/);
    });

    it("throws when a dotted 'on' payload source's field isn't a field of the bound item's type", () => {
      const pressEvent: EventNode = {
        id: "widget/declarations/option-pressed",
        kind: "event",
        origin: "own",
        assertable: false,
        name: "option-pressed",
        payloadType: { kind: "record", fields: { value: { kind: "string" } } },
      };
      const widget = makeWidget({
        declarations: [optionsProp, pressEvent],
        composition: [
          makeUses({
            root: true,
            slotContent: { default: { each: { over: "options", as: "option", use: "option-template" } } },
          }),
          makeOptionUses({ on: { press: { event: "option-pressed", payload: { value: "option.missing" } } } }),
        ],
      });
      expect(() => checkComposition(widget)).toThrow(/'missing' is not a field of 'option''s item type/);
    });
  });

  describe("resource", () => {
    const profileResource: ResourceNode = {
      id: "widget/declarations/profile",
      kind: "resource",
      origin: "own",
      assertable: false,
      name: "profile",
      dataType: { kind: "record", fields: { email: { kind: "string" } } },
    };

    it("a derived value can reference a resource's value graph type, list<dataType>", () => {
      const loaded: DerivedNode = {
        id: "widget/declarations/loaded",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "loaded",
        valueType: { kind: "bool" },
        expr: { type: "unop", op: "not", expr: { type: "builtin", name: "isEmpty", args: [{ type: "ref", name: "profile" }] } },
      };
      const widget = makeWidget({ declarations: [profileResource, loaded] });
      expect(() => checkComposition(widget)).not.toThrow();
    });

    it("rejects a derived expression that treats a resource as anything other than list<dataType>", () => {
      const wrong: DerivedNode = {
        id: "widget/declarations/wrong",
        kind: "derived",
        origin: "own",
        assertable: false,
        name: "wrong",
        valueType: { kind: "string" },
        expr: { type: "member", target: { type: "ref", name: "profile" }, property: "email" },
      };
      const widget = makeWidget({ declarations: [profileResource, wrong] });
      expect(() => checkComposition(widget)).toThrow(/invalid expression/);
    });

    it("lets a composed {expr} prop reference a resource's value graph type", () => {
      const widget = makeWidget({
        declarations: [profileResource],
        composition: [
          makeBoolUses({
            root: true,
            props: {
              disabled: {
                expr: { type: "builtin", name: "isEmpty", args: [{ type: "ref", name: "profile" }] },
              },
            },
          }),
        ],
      });
      expect(() => checkComposition(widget)).not.toThrow();
    });
  });
});
