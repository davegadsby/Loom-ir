import { describe, expect, it } from "vitest";
import { emitAxeChecks } from "./axe.js";
import { makeFixture } from "./fixtures.js";

describe("emitAxeChecks", () => {
  it("emits one file per pattern-conformance/delta node", () => {
    const files = emitAxeChecks(makeFixture());
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path).sort()).toEqual([
      "widget.label-delta.axe.test.ts",
      "widget.switch-pattern.axe.test.ts",
    ]);
  });

  it("references the originating node id and imports jest-axe", () => {
    const files = emitAxeChecks(makeFixture());
    const patternFile = files.find((f) => f.path.includes("switch-pattern"))!;
    expect(patternFile.contents).toContain("widget/a11y/switch-pattern");
    expect(patternFile.contents).toContain('from "jest-axe"');
  });

  it("emits nothing for a component with no a11y nodes", () => {
    const fixture = makeFixture();
    fixture.a11y = [];
    expect(emitAxeChecks(fixture)).toEqual([]);
  });
});
