import { describe, expect, it } from "vitest";
import { parseTypeText } from "./typeText.js";

describe("parseTypeText", () => {
  it("parses primitives", () => {
    expect(parseTypeText("bool")).toEqual({ kind: "bool" });
    expect(parseTypeText("int")).toEqual({ kind: "int" });
    expect(parseTypeText("float")).toEqual({ kind: "float" });
    expect(parseTypeText("string")).toEqual({ kind: "string" });
  });

  it("parses list<T> and option<T>", () => {
    expect(parseTypeText("list<string>")).toEqual({ kind: "list", of: { kind: "string" } });
    expect(parseTypeText("option<int>")).toEqual({ kind: "option", of: { kind: "int" } });
    expect(parseTypeText("list<option<bool>>")).toEqual({
      kind: "list",
      of: { kind: "option", of: { kind: "bool" } },
    });
  });

  it("parses record{...}", () => {
    expect(parseTypeText("record{ checked: bool }")).toEqual({
      kind: "record",
      fields: { checked: { kind: "bool" } },
    });
    expect(parseTypeText("record{a: int, b: string}")).toEqual({
      kind: "record",
      fields: { a: { kind: "int" }, b: { kind: "string" } },
    });
  });

  it("parses enum<Name: a,b,c>", () => {
    expect(parseTypeText("enum<Status: draft,confirmed>")).toEqual({
      kind: "enum",
      name: "Status",
      values: ["draft", "confirmed"],
    });
  });

  it("rejects unknown types and trailing garbage", () => {
    expect(() => parseTypeText("widget")).toThrow();
    expect(() => parseTypeText("bool bool")).toThrow();
  });
});
