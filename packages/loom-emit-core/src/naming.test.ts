import { describe, expect, it } from "vitest";
import { camelCase, capitalize, objectKey, pascalCase } from "./naming.js";

describe("capitalize / pascalCase / camelCase", () => {
  it("capitalizes the first character only", () => {
    expect(capitalize("username")).toBe("Username");
    expect(capitalize("")).toBe("");
  });

  it("pascalCases a kebab-case slug", () => {
    expect(pascalCase("login-dialog")).toBe("LoginDialog");
    expect(pascalCase("button")).toBe("Button");
  });

  it("camelCases a kebab-case slug", () => {
    expect(camelCase("helper-text")).toBe("helperText");
    expect(camelCase("username")).toBe("username");
  });
});

describe("objectKey", () => {
  it("leaves a valid identifier bare — matches today's output for every existing single-word name", () => {
    expect(objectKey("username")).toBe("username");
    expect(objectKey("_private")).toBe("_private");
    expect(objectKey("$special")).toBe("$special");
  });

  it("quotes a kebab-case name — `{ submit-disabled: x }` is a syntax error (parses as subtraction), not a key", () => {
    expect(objectKey("submit-disabled")).toBe('"submit-disabled"');
  });

  it("quotes a name starting with a digit", () => {
    expect(objectKey("2fa-enabled")).toBe('"2fa-enabled"');
  });
});
