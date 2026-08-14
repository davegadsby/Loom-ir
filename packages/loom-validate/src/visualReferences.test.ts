import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkVisualReferencesExist } from "./visualReferences.js";
import { makeFixture, makeVisualFixture } from "./fixtures.js";

describe("checkVisualReferencesExist", () => {
  it("is ok when a component has no visual-conformance nodes at all", () => {
    const result = checkVisualReferencesExist(makeFixture(), tmpdir());
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("is ok when the referenced image exists relative to specDir", () => {
    const specDir = mkdtempSync(join(tmpdir(), "loom-validate-"));
    writeFileSync(join(specDir, "reference.png"), "not-a-real-png", "utf8");
    const result = checkVisualReferencesExist(makeVisualFixture("reference.png"), specDir);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("reports an issue when the referenced image doesn't exist", () => {
    const specDir = mkdtempSync(join(tmpdir(), "loom-validate-"));
    const result = checkVisualReferencesExist(makeVisualFixture("missing.png"), specDir);
    expect(result).toEqual({ ok: false, issues: [{ nodeId: "widget/style/matches-reference", path: "missing.png" }] });
  });

  it("ignores a figma-frame reference — nothing to check on disk", () => {
    const component = makeFixture();
    component.style = [
      {
        id: "widget/style/matches-figma",
        kind: "visual-conformance",
        origin: "own",
        assertable: true,
        verify: "visual",
        reference: { kind: "figma-frame", frameId: "widget-default" },
      },
    ];
    const result = checkVisualReferencesExist(component, tmpdir());
    expect(result).toEqual({ ok: true, issues: [] });
  });
});
