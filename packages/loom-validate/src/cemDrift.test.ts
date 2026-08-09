import { describe, expect, it } from "vitest";
import { checkCemDrift } from "./cemDrift.js";
import { makeFixture } from "./fixtures.js";

describe("checkCemDrift", () => {
  it("always reports not-checked, since §11.3's direction is still open", () => {
    const result = checkCemDrift(makeFixture());
    expect(result.status).toBe("not-checked");
    expect(result.note).toMatch(/§11\.3/);
  });
});
