import { describe, expect, it } from "vitest";
import { lower } from "./lower.js";
import { makeCheckboxFixture } from "./testFixtures.js";
import type { ComponentNode, SlotNode } from "./nodes.js";

function withSlots(...names: string[]): ComponentNode {
  const component = makeCheckboxFixture();
  const slots: SlotNode[] = names.map((name) => ({
    id: `checkbox/declarations/${name}`,
    kind: "slot",
    origin: "own",
    assertable: false,
    name,
  }));
  return { ...component, declarations: [...component.declarations, ...slots] };
}

describe("lower — non-composition slots", () => {
  it("produces no render nodes for a component with no declared slots", () => {
    expect(lower(makeCheckboxFixture())).toEqual([]);
  });

  it("lowers each declared slot to a slot render node, in declaration order", () => {
    const tree = lower(withSlots("title", "body", "actions"));
    expect(tree).toEqual([
      { kind: "slot", name: "title" },
      { kind: "slot", name: "body" },
      { kind: "slot", name: "actions" },
    ]);
  });

  it("preserves declaration order even when 'default' is not first — printers, not lower(), decide display order", () => {
    const tree = lower(withSlots("default", "helper-text"));
    expect(tree).toEqual([
      { kind: "slot", name: "default" },
      { kind: "slot", name: "helper-text" },
    ]);
  });

  it("does not emit render nodes for non-slot declarations", () => {
    const tree = lower(withSlots("body"));
    expect(tree).toEqual([{ kind: "slot", name: "body" }]);
  });
});
