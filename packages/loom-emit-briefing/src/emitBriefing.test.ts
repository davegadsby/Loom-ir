import { describe, expect, it } from "vitest";
import { emitBriefing } from "./emitBriefing.js";
import { makeFixture } from "./fixtures.js";

describe("emitBriefing", () => {
  it("emits one markdown file per component", () => {
    const [file] = emitBriefing(makeFixture());
    expect(file!.path).toBe("checkbox.briefing.md");
    expect(file!.contents).toContain("# checkbox");
  });

  it("renders Intent and Rationale from the same prose nodes as the tree", () => {
    const [file] = emitBriefing(makeFixture());
    expect(file!.contents).toContain("## Intent");
    expect(file!.contents).toContain("Toggles a boolean choice.");
    expect(file!.contents).toContain("## Rationale");
    expect(file!.contents).toContain("Modeled as a two-state machine.");
  });

  it("summarizes claims with their verify route and provenance", () => {
    const [file] = emitBriefing(makeFixture());
    expect(file!.contents).toContain("checkbox/claims/own-invariant");
    expect(file!.contents).toContain("| invariant | unit | own |");
    expect(file!.contents).toContain("inherited from `interactive-base`");
  });

  it("marks UnexpressibleNode as unverifiable in the claims table regardless of its verify field", () => {
    const [file] = emitBriefing(makeFixture());
    expect(file!.contents).toContain("checkbox/claims/subjective");
    expect(file!.contents).toContain("| unexpressible | unverifiable | own |");
  });

  it("summarizes a11y nodes in their own table", () => {
    const [file] = emitBriefing(makeFixture());
    expect(file!.contents).toContain("## Accessibility");
    expect(file!.contents).toContain("checkbox/a11y/checkbox-pattern");
  });

  it("omits the Intent/Rationale/Claims/Accessibility sections when a component has none", () => {
    const fixture = makeFixture();
    fixture.prose = [];
    fixture.claims = [];
    fixture.a11y = [];
    const [file] = emitBriefing(fixture);
    expect(file!.contents).not.toContain("## Intent");
    expect(file!.contents).not.toContain("## Claims");
    expect(file!.contents).not.toContain("## Accessibility");
  });
});
