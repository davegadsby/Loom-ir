import { describe, expect, it } from "vitest";
import { makeStyleTokensFixture } from "./fixtures.js";
import { emitTokensCss } from "./emitTokensCss.js";

describe("emitTokensCss", () => {
  it("renders every leaf as a :root custom property named after its dot path", () => {
    const file = emitTokensCss(makeStyleTokensFixture());
    expect(file.path).toBe("tokens.css");
    expect(file.contents).toContain(":root {");
    expect(file.contents).toContain("--color-surface-default: #F5F5F5;");
    expect(file.contents).toContain("--color-surface-disabled: #E0E0E0;");
    expect(file.contents).toContain("--spacing-sm: 4px;");
    expect(file.contents).toContain("--spacing-md: 8px;");
  });
});
