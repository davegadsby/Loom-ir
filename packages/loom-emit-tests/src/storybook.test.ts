import { describe, expect, it } from "vitest";
import { emitStorybookPlay } from "./storybook.js";
import { makeFixture } from "./fixtures.js";
import type { ComponentNode } from "loom-ir";

/** `makeFixture` has an a11y pattern of "switch", not "checkbox", and its one scenario's `from` is the machine's own initial state — neither branch this backend needs to choose between is exercised by it alone. */
function makeCheckboxPatternFixture(): ComponentNode {
  const component = makeFixture();
  component.a11y = [
    {
      id: "widget/a11y/checkbox-pattern",
      kind: "pattern-conformance",
      origin: "own",
      assertable: true,
      verify: "a11y",
      pattern: "checkbox",
    },
  ];
  return component;
}

describe("emitStorybookPlay", () => {
  it("emits one file per component with scenario claims, not one per scenario", () => {
    const files = emitStorybookPlay(makeFixture());
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("Widget.stories.tsx");
  });

  it("emits nothing for a component with no scenario claims", () => {
    const fixture = makeFixture();
    fixture.claims = fixture.claims.filter((c) => c.kind !== "scenario");
    expect(emitStorybookPlay(fixture)).toEqual([]);
  });

  it("emits a real CSF3 story: component meta, one named story export, a play function that drives and asserts", () => {
    const [file] = emitStorybookPlay(makeFixture());
    expect(file!.contents).toContain('import { Widget } from "./Widget";');
    expect(file!.contents).toContain("const meta: Meta<typeof Widget> = { component: Widget");
    expect(file!.contents).toContain("export const FlipTurnsOn: Story = {");
    expect(file!.contents).toContain("await userEvent.click(root);");
    expect(file!.contents).toContain('await expect(readState(root)).toBe("off");');
    expect(file!.contents).toContain('await expect(readState(root)).toBe("on");');
  });

  it("references the originating node id", () => {
    const [file] = emitStorybookPlay(makeFixture());
    expect(file!.contents).toContain("widget/claims/flip-turns-on");
  });

  it("reads state via a real DOM attribute query, scoped to this component's own data-loom-component", () => {
    const [file] = emitStorybookPlay(makeFixture());
    expect(file!.contents).toContain('canvasElement.querySelector(\'[data-loom-component="widget"]\')');
    expect(file!.contents).toContain('root.getAttribute("data-state")');
  });

  it("reads state via the .checked DOM property instead of data-state when the a11y pattern is checkbox", () => {
    const [file] = emitStorybookPlay(makeCheckboxPatternFixture());
    expect(file!.contents).toContain("(root as HTMLInputElement).checked");
    expect(file!.contents).not.toContain("data-state");
  });

  it("seeds args when a scenario doesn't start at the machine's own initial state", () => {
    const fixture = makeFixture();
    fixture.claims = [
      ...fixture.claims,
      {
        id: "widget/claims/flip-turns-off",
        kind: "scenario",
        origin: "own",
        assertable: true,
        verify: "interaction",
        from: "on",
        events: [{ kind: "event", name: "click" }],
        to: "off",
      },
    ];
    // "on" isn't the machine's initial state ("off"), and no declared bool prop mirrors
    // it, so this scenario can't be reached via args — a clear emit-time error, not a
    // silently-broken story.
    expect(() => emitStorybookPlay(fixture)).toThrow(/no seed prop mirrors 'on'/);
  });
});
