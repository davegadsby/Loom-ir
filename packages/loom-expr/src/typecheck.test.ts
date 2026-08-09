import { describe, expect, it } from "vitest";
import { parseExpr } from "./parser.js";
import { typecheck, TypeError as LoomTypeError } from "./typecheck.js";
import type { TypecheckContext } from "./context.js";

const ctx: TypecheckContext = {
  props: { disabled: { kind: "bool" }, count: { kind: "int" } },
  machine: {
    stateType: { kind: "record", fields: { id: { kind: "string" }, disabled: { kind: "bool" }, focusable: { kind: "bool" } } },
    states: [],
    transitionType: { kind: "record", fields: { id: { kind: "string" }, to: { kind: "string" } } },
    transitions: [],
  },
};

describe("typecheck", () => {
  it("types boolean logic as bool", () => {
    expect(typecheck(parseExpr("disabled and not disabled"), ctx)).toEqual({ kind: "bool" });
  });

  it("rejects 'and' over non-bool operands", () => {
    expect(() => typecheck(parseExpr("count and disabled"), ctx)).toThrow(LoomTypeError);
  });

  it("types arithmetic and rejects mismatches", () => {
    expect(typecheck(parseExpr("count + 1"), ctx)).toEqual({ kind: "int" });
    expect(() => typecheck(parseExpr("count + disabled"), ctx)).toThrow(LoomTypeError);
  });

  it("types member access against the machine's state record", () => {
    const expr = parseExpr("all (s in states) implies(s.disabled, not s.focusable)");
    expect(typecheck(expr, ctx)).toEqual({ kind: "bool" });
  });

  it("rejects member access to an unknown field", () => {
    const expr = parseExpr("all (s in states) s.nope");
    expect(() => typecheck(expr, ctx)).toThrow(LoomTypeError);
  });

  it("types count quantifiers as int", () => {
    const expr = parseExpr("count (s in states) s.disabled");
    expect(typecheck(expr, ctx)).toEqual({ kind: "int" });
  });

  it("types 'in' against a matching list type", () => {
    const expr = parseExpr("t.to in states");
    expect(typecheck(expr, ctx, { t: { kind: "record", fields: { to: { kind: "string" } } } })).toEqual({ kind: "bool" });
  });

  it("rejects an unresolved reference", () => {
    expect(() => typecheck(parseExpr("nope"), ctx)).toThrow(LoomTypeError);
  });

  it("types ternary branches and rejects mismatched branch types", () => {
    expect(typecheck(parseExpr("disabled ? 1 : 2"), ctx)).toEqual({ kind: "int" });
    expect(() => typecheck(parseExpr("disabled ? 1 : 'x'"), ctx)).toThrow(LoomTypeError);
  });
});
