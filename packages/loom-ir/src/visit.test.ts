import { describe, expect, it } from "vitest";
import { allNodes, children, findById, reduce, visit } from "./visit.js";
import { makeCheckboxFixture } from "./testFixtures.js";

describe("visit utilities", () => {
  it("children() returns the component's direct children across all taxonomy groups", () => {
    const tree = makeCheckboxFixture();
    const kinds = children(tree).map((n) => n.kind);
    expect(kinds).toEqual(["prop", "state", "state", "transition", "invariant"]);
  });

  it("children() of a leaf node is empty", () => {
    const tree = makeCheckboxFixture();
    expect(children(tree.claims[0]!)).toEqual([]);
  });

  it("visit() walks every node depth-first including the root", () => {
    const tree = makeCheckboxFixture();
    const seen: string[] = [];
    visit(tree, (n) => seen.push(n.id));
    expect(seen).toEqual([
      "checkbox",
      "checkbox/declarations/disabled",
      "checkbox/machine/unchecked",
      "checkbox/machine/checked",
      "checkbox/machine/toggle",
      "checkbox/claims/disabled-not-focusable",
    ]);
  });

  it("reduce() folds over the whole tree", () => {
    const tree = makeCheckboxFixture();
    const count = reduce(tree, (acc) => acc + 1, 0);
    expect(count).toBe(6);
  });

  it("findById() locates a node anywhere in the tree", () => {
    const tree = makeCheckboxFixture();
    const found = findById(tree, "checkbox/claims/disabled-not-focusable");
    expect(found?.kind).toBe("invariant");
  });

  it("findById() returns undefined for an unknown id", () => {
    const tree = makeCheckboxFixture();
    expect(findById(tree, "checkbox/claims/nope")).toBeUndefined();
  });

  it("allNodes() flattens the tree in the same order as visit()", () => {
    const tree = makeCheckboxFixture();
    expect(allNodes(tree).map((n) => n.id)).toEqual((() => {
      const seen: string[] = [];
      visit(tree, (n) => seen.push(n.id));
      return seen;
    })());
  });
});
