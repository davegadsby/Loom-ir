import { describe, expect, it } from "vitest";
import { computeNodeId } from "./id.js";

describe("computeNodeId", () => {
  it("joins component, section and slug structurally", () => {
    expect(computeNodeId("checkbox", "claims", "disabled-cannot-be-toggled")).toBe(
      "checkbox/claims/disabled-cannot-be-toggled"
    );
  });

  it("is stable across identical calls (pure function of structural position)", () => {
    const a = computeNodeId("checkbox", "machine", "toggle");
    const b = computeNodeId("checkbox", "machine", "toggle");
    expect(a).toBe(b);
  });

  it("rejects non-kebab-case slugs", () => {
    expect(() => computeNodeId("Checkbox", "claims", "x")).toThrow();
    expect(() => computeNodeId("checkbox", "claims", "Not Kebab")).toThrow();
    expect(() => computeNodeId("checkbox", "claims", "trailing-")).toThrow();
  });
});
