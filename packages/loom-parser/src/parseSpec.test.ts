import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSpec } from "./parseSpec.js";
import type { ComponentNode } from "loom-ir";

function readExample(name: string): string {
  const path = fileURLToPath(new URL(`../../../examples/specs/${name}`, import.meta.url));
  return readFileSync(path, "utf8");
}

function parseInteractiveBase(): ComponentNode {
  return parseSpec(readExample("interactive-base.md"));
}

function parseCheckbox(): ComponentNode {
  const base = parseInteractiveBase();
  return parseSpec(readExample("checkbox.md"), {
    resolveBase: (ref) => {
      if (ref === "interactive-base") return base;
      throw new Error(`unknown base spec '${ref}'`);
    },
  });
}

function parseDisclosure(): ComponentNode {
  const base = parseInteractiveBase();
  return parseSpec(readExample("disclosure.md"), {
    resolveBase: (ref) => {
      if (ref === "interactive-base") return base;
      throw new Error(`unknown base spec '${ref}'`);
    },
  });
}

describe("parseSpec — interactive-base (no inheritance)", () => {
  it("parses frontmatter and declarations", () => {
    const base = parseInteractiveBase();
    expect(base.id).toBe("interactive-base");
    expect(base.declarations).toHaveLength(1);
    expect(base.declarations[0]).toMatchObject({ kind: "prop", name: "disabled", id: "interactive-base/declarations/disabled" });
  });

  it("parses a property claim over the states domain", () => {
    const base = parseInteractiveBase();
    expect(base.claims).toHaveLength(1);
    const prop = base.claims[0]!;
    expect(prop).toMatchObject({ kind: "property", ident: "s", domain: { kind: "states" } });
  });

  it("all own nodes have origin 'own'", () => {
    const base = parseInteractiveBase();
    expect(base.declarations[0]!.origin).toBe("own");
    expect(base.claims[0]!.origin).toBe("own");
  });
});

describe("parseSpec — checkbox (extends interactive-base)", () => {
  it("flattens the inherited prop with its original id and stamps provenance", () => {
    const checkbox = parseCheckbox();
    const disabled = checkbox.declarations.find((d) => d.name === "disabled");
    expect(disabled).toBeDefined();
    expect(disabled!.id).toBe("interactive-base/declarations/disabled");
    expect(disabled!.origin).toEqual({ inheritedFrom: "interactive-base", overridden: false });
  });

  it("keeps checkbox's own declarations under its own id namespace", () => {
    const checkbox = parseCheckbox();
    const checked = checkbox.declarations.find((d) => d.name === "checked");
    expect(checked!.id).toBe("checkbox/declarations/checked");
    expect(checked!.origin).toBe("own");
  });

  it("parses the machine: two states and two transitions", () => {
    const checkbox = parseCheckbox();
    expect(checkbox.states.map((s) => s.name).sort()).toEqual(["checked", "unchecked"]);
    expect(checkbox.transitions).toHaveLength(2);
    const toggleOn = checkbox.transitions.find((t) => t.name === "toggle-on")!;
    expect(toggleOn.from).toBe("unchecked");
    expect(toggleOn.to).toBe("checked");
    expect(toggleOn.trigger).toEqual({ kind: "event", name: "click" });
    expect(toggleOn.guard).toMatchObject({ type: "unop", op: "not" });
  });

  it("inherits the base's property claim into its own claims list", () => {
    const checkbox = parseCheckbox();
    const inherited = checkbox.claims.find((c) => c.id === "interactive-base/claims/disabled-not-focusable");
    expect(inherited).toBeDefined();
    expect(inherited!.origin).toEqual({ inheritedFrom: "interactive-base", overridden: false });
  });

  it("parses a PathNode and validates it against the machine at parse time", () => {
    const checkbox = parseCheckbox();
    const path = checkbox.claims.find((c) => c.kind === "path");
    expect(path).toMatchObject({ from: "unchecked", to: "checked" });
  });

  it("parses an UnexpressibleNode from prose with no yaml block", () => {
    const checkbox = parseCheckbox();
    const claim = checkbox.claims.find((c) => c.kind === "unexpressible");
    expect(claim).toBeDefined();
    expect((claim as { claim: string }).claim).toMatch(/feeling instantaneous/);
  });

  it("parses the pattern-conformance a11y node", () => {
    const checkbox = parseCheckbox();
    expect(checkbox.a11y).toHaveLength(1);
    expect(checkbox.a11y[0]).toMatchObject({ kind: "pattern-conformance", pattern: "checkbox" });
  });

  it("parses intent and rationale as non-assertable prose nodes", () => {
    const checkbox = parseCheckbox();
    expect(checkbox.prose.map((p) => p.kind).sort()).toEqual(["intent", "rationale"]);
    expect(checkbox.prose.every((p) => p.assertable === false)).toBe(true);
  });
});

describe("parseSpec — disclosure (extends interactive-base; covers the rest of the taxonomy)", () => {
  it("parses two named slots and an unsupported method declaration", () => {
    const disclosure = parseDisclosure();
    const slots = disclosure.declarations.filter((d) => d.kind === "slot");
    expect(slots.map((s) => s.name).sort()).toEqual(["panel", "trigger"]);
    const method = disclosure.declarations.find((d) => d.kind === "method");
    expect(method).toMatchObject({ kind: "method", name: "focus-trigger" });
  });

  it("parses a standalone GuardNode and RuleNode alongside states/transitions", () => {
    const disclosure = parseDisclosure();
    expect(disclosure.guards).toHaveLength(1);
    expect(disclosure.guards[0]).toMatchObject({ name: "can-toggle" });
    expect(disclosure.rules).toHaveLength(1);
    expect(disclosure.rules[0]).toMatchObject({ name: "disabled-locks-collapsed" });
    expect(disclosure.rules[0]!.condition).toMatchObject({ type: "ref", name: "disabled" });
  });

  it("parses an InvariantNode", () => {
    const disclosure = parseDisclosure();
    const invariant = disclosure.claims.find((c) => c.kind === "invariant");
    expect(invariant).toMatchObject({ kind: "invariant", verify: "unit" });
  });

  it("parses a PathNode validated against its own machine at parse time", () => {
    const disclosure = parseDisclosure();
    const path = disclosure.claims.find((c) => c.kind === "path");
    expect(path).toMatchObject({ from: "collapsed", to: "expanded" });
  });

  it("inherits interactive-base's prop and property claim, same as checkbox does", () => {
    const disclosure = parseDisclosure();
    const disabled = disclosure.declarations.find((d) => d.name === "disabled");
    expect(disabled!.id).toBe("interactive-base/declarations/disabled");
    expect(disabled!.origin).toEqual({ inheritedFrom: "interactive-base", overridden: false });
  });

  it("parses DeltaNode and AriaRelationNode a11y nodes", () => {
    const disclosure = parseDisclosure();
    expect(disclosure.a11y.map((n) => n.kind).sort()).toEqual(["aria-relation", "delta", "pattern-conformance"]);
    const relation = disclosure.a11y.find((n) => n.kind === "aria-relation");
    expect(relation).toMatchObject({ relation: "aria-controls", assertable: false });
    const delta = disclosure.a11y.find((n) => n.kind === "delta");
    expect(delta).toMatchObject({ assertable: true, verify: "a11y" });
  });
});

describe("parseSpec — Style section", () => {
  const styleSpec = `---
name: swatch
kind: primitive
tokens: design-tokens.json
---

## Declarations

### label

\`\`\`yaml
kind: slot
\`\`\`

## Style

### root-background

\`\`\`yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
\`\`\`

### root-layout

\`\`\`yaml
kind: layout-intent
part: root
display: flex
direction: row
gapToken: spacing.sm
\`\`\`

### matches-figma

\`\`\`yaml
kind: visual-conformance
reference: figma://frame/123
\`\`\`
`;

  it("parses a token-ref node", () => {
    const swatch = parseSpec(styleSpec);
    const tokenRef = swatch.style.find((n) => n.kind === "token-ref");
    expect(tokenRef).toMatchObject({
      part: "root",
      property: "background-color",
      token: "color.surface.default",
      assertable: true,
    });
    expect(tokenRef!.id).toBe("swatch/style/root-background");
  });

  it("parses a layout-intent node with optional fields", () => {
    const swatch = parseSpec(styleSpec);
    const layout = swatch.style.find((n) => n.kind === "layout-intent");
    expect(layout).toMatchObject({ part: "root", display: "flex", direction: "row", gapToken: "spacing.sm" });
  });

  it("parses a visual-conformance node with the 'visual' verify route", () => {
    const swatch = parseSpec(styleSpec);
    const visual = swatch.style.find((n) => n.kind === "visual-conformance");
    expect(visual).toMatchObject({ reference: "figma://frame/123", verify: "visual", assertable: true });
  });

  it("reads the frontmatter 'tokens' reference", () => {
    // frontmatter isn't retained on ComponentNode directly, but parsing must not reject the extra field
    expect(() => parseSpec(styleSpec)).not.toThrow();
  });
});

describe("parseSpec — Composition section", () => {
  const leafSpec = `---
name: leaf
kind: primitive
---

## Declarations

### variant

\`\`\`yaml
kind: prop
type: string
default: primary
\`\`\`

### default

\`\`\`yaml
kind: slot
\`\`\`

### press

\`\`\`yaml
kind: event
payloadType: "record{}"
\`\`\`
`;

  function parseLeaf(): ComponentNode {
    return parseSpec(leafSpec);
  }

  const compositeSpec = `---
name: widget
kind: composite
---

## Declarations

### open

\`\`\`yaml
kind: prop
type: bool
default: false
\`\`\`

### closed

\`\`\`yaml
kind: event
payloadType: "record{}"
\`\`\`

## Composition

### root-node

\`\`\`yaml
kind: uses
component: leaf
root: true
visibleWhen: open
props:
  variant: danger
slotContent:
  default:
    text: "Confirm"
on:
  press: closed
\`\`\`
`;

  function parseComposite(): ComponentNode {
    const leaf = parseLeaf();
    return parseSpec(compositeSpec, {
      resolveComponent: (ref) => {
        if (ref === "leaf") return leaf;
        throw new Error(`unknown component '${ref}'`);
      },
    });
  }

  it("parses a uses node with props, slotContent, on, and visibleWhen", () => {
    const widget = parseComposite();
    expect(widget.composition).toHaveLength(1);
    const node = widget.composition[0]!;
    expect(node).toMatchObject({
      kind: "uses",
      name: "root-node",
      component: "leaf",
      root: true,
      visibleWhen: "open",
      props: { variant: "danger" },
      slotContent: { default: { text: "Confirm" } },
      on: { press: "closed" },
      assertable: false,
    });
    expect(node.resolvedComponent.name).toBe("leaf");
    expect(node.id).toBe("widget/composition/root-node");
  });

  it("throws when Composition is present but no resolveComponent is supplied", () => {
    expect(() => parseSpec(compositeSpec)).toThrow(/resolveComponent/);
  });

  it("throws when Composition is present but frontmatter.kind isn't 'composite'", () => {
    const primitiveWithComposition = compositeSpec.replace("kind: composite", "kind: primitive");
    const leaf = parseLeaf();
    expect(() =>
      parseSpec(primitiveWithComposition, { resolveComponent: () => leaf })
    ).toThrow(/frontmatter.kind is 'primitive', expected 'composite'/);
  });

  it("throws when an extends base itself declares a Composition section", () => {
    const leaf = parseLeaf();
    const baseWithComposition = parseSpec(compositeSpec, { resolveComponent: () => leaf });
    const childExtendingComposite = `---
name: child-of-composite
kind: composite
extends: [widget]
---

## Intent

Irrelevant.
`;
    expect(() =>
      parseSpec(childExtendingComposite, {
        resolveBase: (ref) => {
          if (ref === "widget") return baseWithComposition;
          throw new Error(`unknown base '${ref}'`);
        },
      })
    ).toThrow(/extends \[widget\] which declare their own Composition/);
  });
});

describe("parseSpec — error handling", () => {
  it("throws when extends is present but no resolveBase is supplied", () => {
    expect(() => parseSpec(readExample("checkbox.md"))).toThrow(/resolveBase/);
  });

  it("throws a PathCheckError-shaped error for a path that doesn't trace real transitions", () => {
    const badSpec = `---
name: broken
kind: primitive
---

## Machine

### only-state

\`\`\`yaml
kind: state
\`\`\`

## Claims

### bad-path

\`\`\`yaml
kind: path
from: only-state
events:
  - { kind: event, name: click }
to: only-state
\`\`\`
`;
    expect(() => parseSpec(badSpec)).toThrow(/no transition/);
  });

  it("rejects a node block that fails its schema validation", () => {
    const badSpec = `---
name: broken
kind: primitive
---

## Declarations

### mystery

\`\`\`yaml
kind: prop
\`\`\`
`;
    // missing required 'type' field for a prop
    expect(() => parseSpec(badSpec)).toThrow();
  });
});
