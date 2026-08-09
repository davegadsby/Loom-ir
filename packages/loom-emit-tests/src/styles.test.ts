import { describe, expect, it } from "vitest";
import { emitTokenConformanceTests } from "./styles.js";
import { makeFixture, makeStyledFixture } from "./fixtures.js";

describe("emitTokenConformanceTests", () => {
  it("emits one file per token-ref node", () => {
    const files = emitTokenConformanceTests(makeStyledFixture());
    expect(files.map((f) => f.path).sort()).toEqual([
      "widget.root-background.style.test.ts",
      "widget.root-padding.style.test.ts",
    ]);
  });

  it("references the originating node id, imports loom-emit-styles, and asserts the expected CSS declaration via the real backend", () => {
    const files = emitTokenConformanceTests(makeStyledFixture());
    const file = files.find((f) => f.path.includes("root-background"))!;
    expect(file.contents).toContain("widget/style/root-background");
    expect(file.contents).toContain('from "loom-emit-styles"');
    expect(file.contents).toContain("background-color: var(${tokenCssVar(\"color.surface.default\")});");
  });

  it("emits nothing for a component with no token-ref nodes", () => {
    expect(emitTokenConformanceTests(makeFixture())).toEqual([]);
  });
});
