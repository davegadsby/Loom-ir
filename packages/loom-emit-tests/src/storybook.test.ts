import { describe, expect, it } from "vitest";
import { emitStorybookPlay } from "./storybook.js";
import { makeFixture } from "./fixtures.js";

describe("emitStorybookPlay", () => {
  it("emits one file per ScenarioNode", () => {
    const files = emitStorybookPlay(makeFixture());
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("widget.flip-turns-on.stories.play.ts");
  });

  it("references the originating node id", () => {
    const [file] = emitStorybookPlay(makeFixture());
    expect(file!.contents).toContain("widget/claims/flip-turns-on");
  });

  it("emits nothing for a component with no scenario claims", () => {
    const fixture = makeFixture();
    fixture.claims = fixture.claims.filter((c) => c.kind !== "scenario");
    expect(emitStorybookPlay(fixture)).toEqual([]);
  });
});
