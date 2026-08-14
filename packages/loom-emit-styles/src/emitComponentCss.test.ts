import { describe, expect, it } from "vitest";
import { makeStyledCheckboxFixture } from "./fixtures.js";
import { emitComponentCss } from "./emitComponentCss.js";

describe("emitComponentCss", () => {
  it("emits one rule per styled part, using var(--token) for token-refs and literal flex declarations for layout-intent", () => {
    const file = emitComponentCss(makeStyledCheckboxFixture());
    expect(file.path).toBe("Checkbox.css");
    expect(file.contents).toContain(".loom-checkbox {");
    expect(file.contents).toContain("background-color: var(--color-surface-default);");
    expect(file.contents).toContain("display: flex;");
    expect(file.contents).toContain("flex-direction: row;");
    expect(file.contents).toContain("align-items: center;");
    expect(file.contents).toContain("gap: var(--spacing-sm);");
    expect(file.contents).toContain(".loom-checkbox__label {");
    expect(file.contents).toContain("color: var(--color-surface-disabled);");
  });

  it("skips a part with no style declarations and never emits a rule for a visual-conformance node", () => {
    const component = makeStyledCheckboxFixture();
    component.style = [
      ...component.style,
      {
        id: "checkbox/style/matches-figma",
        kind: "visual-conformance",
        origin: "own",
        assertable: true,
        verify: "visual",
        reference: { kind: "figma-frame", frameId: "figma-frame-123" },
      },
    ];
    const file = emitComponentCss(component);
    expect(file.contents).not.toContain("matches-figma");
  });
});
