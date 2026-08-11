import { describe, expect, it } from "vitest";
import type { Expr } from "loom-expr";
import { compileExprToJs, type RefResolver } from "./compileExpr.js";

const identity: RefResolver = (name) => name;

describe("compileExprToJs", () => {
  it("compiles a literal", () => {
    expect(compileExprToJs({ type: "literal", valueType: { kind: "bool" }, value: true }, identity)).toBe("true");
    expect(compileExprToJs({ type: "literal", valueType: { kind: "string" }, value: "hi" }, identity)).toBe('"hi"');
  });

  it("compiles a ref through the resolver, not the raw name", () => {
    const resolver: RefResolver = (name) => `this.${name}Value`;
    expect(compileExprToJs({ type: "ref", name: "username" }, resolver)).toBe("this.usernameValue");
  });

  it("compiles member access, recursively", () => {
    const expr: Expr = { type: "member", target: { type: "ref", name: "task" }, property: "label" };
    expect(compileExprToJs(expr, identity)).toBe("task.label");
  });

  it("compiles unop not/neg", () => {
    expect(compileExprToJs({ type: "unop", op: "not", expr: { type: "ref", name: "disabled" } }, identity)).toBe(
      "!(disabled)"
    );
    expect(compileExprToJs({ type: "unop", op: "neg", expr: { type: "ref", name: "x" } }, identity)).toBe("-(x)");
  });

  it("compiles every binop", () => {
    const l: Expr = { type: "ref", name: "a" };
    const r: Expr = { type: "ref", name: "b" };
    const binop = (op: Extract<Expr, { type: "binop" }>["op"]) =>
      compileExprToJs({ type: "binop", op, left: l, right: r }, identity);
    expect(binop("and")).toBe("(a && b)");
    expect(binop("or")).toBe("(a || b)");
    expect(binop("implies")).toBe("(!(a) || b)");
    expect(binop("==")).toBe("(a === b)");
    expect(binop("!=")).toBe("(a !== b)");
    expect(binop("<")).toBe("(a < b)");
    expect(binop("<=")).toBe("(a <= b)");
    expect(binop(">")).toBe("(a > b)");
    expect(binop(">=")).toBe("(a >= b)");
    expect(binop("+")).toBe("(a + b)");
    expect(binop("-")).toBe("(a - b)");
    expect(binop("in")).toBe("(b).includes(a)");
  });

  it("compiles a ternary", () => {
    const expr: Expr = {
      type: "ternary",
      cond: { type: "ref", name: "c" },
      then: { type: "ref", name: "t" },
      else: { type: "ref", name: "e" },
    };
    expect(compileExprToJs(expr, identity)).toBe("(c ? t : e)");
  });

  it("compiles every builtin", () => {
    const arg = (name: string): Expr => ({ type: "ref", name });
    expect(compileExprToJs({ type: "builtin", name: "len", args: [arg("xs")] }, identity)).toBe("(xs).length");
    expect(compileExprToJs({ type: "builtin", name: "isEmpty", args: [arg("xs")] }, identity)).toBe(
      "(xs).length === 0"
    );
    expect(compileExprToJs({ type: "builtin", name: "matches", args: [arg("s"), arg("p")] }, identity)).toBe(
      "new RegExp(p).test(s)"
    );
    expect(compileExprToJs({ type: "builtin", name: "contains", args: [arg("xs"), arg("v")] }, identity)).toBe(
      "(xs).includes(v)"
    );
    expect(compileExprToJs({ type: "builtin", name: "oneOf", args: [arg("v"), arg("xs")] }, identity)).toBe(
      "(xs).includes(v)"
    );
    expect(compileExprToJs({ type: "builtin", name: "distinct", args: [arg("xs")] }, identity)).toBe(
      "(xs).every((x, i, a) => a.indexOf(x) === i)"
    );
    expect(compileExprToJs({ type: "builtin", name: "sorted", args: [arg("xs")] }, identity)).toBe(
      "(xs).every((x, i, a) => i === 0 || a[i - 1] <= x)"
    );
  });

  it("compiles a real field-validate-shaped expression (matches + len)", () => {
    const emailValid: Expr = {
      type: "builtin",
      name: "matches",
      args: [
        { type: "ref", name: "email" },
        { type: "literal", valueType: { kind: "string" }, value: "^[^@]+@[^@]+$" },
      ],
    };
    expect(compileExprToJs(emailValid, identity)).toBe('new RegExp("^[^@]+@[^@]+$").test(email)');
  });

  it("compiles a real derived-value-shaped expression (not isEmpty(x))", () => {
    const expr: Expr = { type: "unop", op: "not", expr: { type: "builtin", name: "isEmpty", args: [{ type: "ref", name: "tasks" }] } };
    expect(compileExprToJs(expr, identity)).toBe("!((tasks).length === 0)");
  });

  it("throws for quant/statesRef/transitionsRef — claim-only, not supported for component-level exprs", () => {
    const quant: Expr = {
      type: "quant",
      quant: "all",
      ident: "x",
      domain: { kind: "oneOf", literals: [] },
      body: { type: "ref", name: "x" },
    };
    expect(() => compileExprToJs(quant, identity)).toThrow(/requires a claim's machine context/);
    expect(() => compileExprToJs({ type: "statesRef" }, identity)).toThrow(/requires a claim's machine context/);
    expect(() => compileExprToJs({ type: "transitionsRef" }, identity)).toThrow(/requires a claim's machine context/);
  });

  it("the resolver can throw for an unresolved name, and that throw propagates", () => {
    const throwingResolver: RefResolver = (name) => {
      throw new Error(`unresolved: ${name}`);
    };
    expect(() => compileExprToJs({ type: "ref", name: "mystery" }, throwingResolver)).toThrow("unresolved: mystery");
  });
});
