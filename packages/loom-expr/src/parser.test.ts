import { describe, expect, it } from "vitest";
import { parseExpr, parseDomain, parseQuantifiedClaim } from "./parser.js";

describe("parseExpr", () => {
  it("parses literals", () => {
    expect(parseExpr("true")).toEqual({ type: "literal", valueType: { kind: "bool" }, value: true });
    expect(parseExpr("42")).toEqual({ type: "literal", valueType: { kind: "int" }, value: 42 });
    expect(parseExpr("3.5")).toEqual({ type: "literal", valueType: { kind: "float" }, value: 3.5 });
    expect(parseExpr("'hi'")).toEqual({ type: "literal", valueType: { kind: "string" }, value: "hi" });
  });

  it("parses implies both infix and call sugar identically", () => {
    const infix = parseExpr("disabled implies not focusable");
    const call = parseExpr("implies(disabled, not focusable)");
    expect(infix).toEqual(call);
    expect(infix).toMatchObject({ type: "binop", op: "implies" });
  });

  it("parses member access chains", () => {
    expect(parseExpr("s.disabled")).toEqual({
      type: "member",
      target: { type: "ref", name: "s" },
      property: "disabled",
    });
  });

  it("parses 'in' against a bare states reference", () => {
    expect(parseExpr("t.to in states")).toEqual({
      type: "binop",
      op: "in",
      left: { type: "member", target: { type: "ref", name: "t" }, property: "to" },
      right: { type: "statesRef" },
    });
  });

  it("respects precedence: and binds tighter than or, or tighter than implies", () => {
    const expr = parseExpr("a or b and c implies d");
    // implies(or(a, and(b,c)), d)
    expect(expr).toEqual({
      type: "binop",
      op: "implies",
      left: {
        type: "binop",
        op: "or",
        left: { type: "ref", name: "a" },
        right: { type: "binop", op: "and", left: { type: "ref", name: "b" }, right: { type: "ref", name: "c" } },
      },
      right: { type: "ref", name: "d" },
    });
  });

  it("parses ternary", () => {
    expect(parseExpr("checked ? 1 : 0")).toEqual({
      type: "ternary",
      cond: { type: "ref", name: "checked" },
      then: { type: "literal", valueType: { kind: "int" }, value: 1 },
      else: { type: "literal", valueType: { kind: "int" }, value: 0 },
    });
  });

  it("parses builtin calls", () => {
    expect(parseExpr("len(tags)")).toEqual({
      type: "builtin",
      name: "len",
      args: [{ type: "ref", name: "tags" }],
    });
  });

  it("parses list literals", () => {
    expect(parseExpr("[1, 2, 3]")).toEqual({
      type: "literal",
      valueType: { kind: "list", of: { kind: "int" } },
      value: [1, 2, 3],
    });
  });

  it("parses quantifiers over states", () => {
    const expr = parseExpr("all (s in states) implies(s.disabled, not s.focusable)");
    expect(expr).toMatchObject({
      type: "quant",
      quant: "all",
      ident: "s",
      domain: { kind: "states" },
      body: { type: "binop", op: "implies" },
    });
  });

  it("throws on trailing garbage", () => {
    expect(() => parseExpr("true true")).toThrow();
  });
});

describe("parseDomain", () => {
  it("parses range", () => {
    expect(parseDomain("range(0, 10)", "x")).toEqual({ kind: "range", lo: 0, hi: 10 });
  });

  it("parses oneOf", () => {
    expect(parseDomain("oneOf [1, 2, 3]", "x")).toEqual({ kind: "oneOf", literals: [1, 2, 3] });
  });

  it("parses where with the bound ident threaded into the predicate", () => {
    const domain = parseDomain("where(range(0, 100), x > 5)", "x");
    expect(domain).toMatchObject({
      kind: "where",
      boundIdent: "x",
      base: { kind: "range", lo: 0, hi: 100 },
      predicate: { type: "binop", op: ">" },
    });
  });

  it("parses states and transitions", () => {
    expect(parseDomain("states", "s")).toEqual({ kind: "states" });
    expect(parseDomain("transitions", "t")).toEqual({ kind: "transitions" });
  });

  it("parses list<domain> size(min,max)", () => {
    expect(parseDomain("list<int> size(1, 3)", "xs")).toEqual({
      kind: "list",
      of: { kind: "type", type: { kind: "int" } },
      size: { min: 1, max: 3 },
    });
  });
});

describe("parseQuantifiedClaim", () => {
  it("parses a property's (ident in domain) body shape", () => {
    const claim = parseQuantifiedClaim("(x in range(0, 100)) x + 1 >= 1");
    expect(claim.ident).toBe("x");
    expect(claim.domain).toEqual({ kind: "range", lo: 0, hi: 100 });
    expect(claim.body).toMatchObject({ type: "binop", op: ">=" });
  });
});
