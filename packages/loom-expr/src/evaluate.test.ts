import { describe, expect, it } from "vitest";
import { parseExpr } from "./parser.js";
import { evaluate } from "./evaluate.js";
import type { MachineContext } from "./context.js";

const machine: MachineContext = {
  stateType: { kind: "record", fields: { id: { kind: "string" }, disabled: { kind: "bool" }, focusable: { kind: "bool" } } },
  states: [
    { id: "unchecked", disabled: false, focusable: true },
    { id: "checked", disabled: false, focusable: true },
    { id: "disabled", disabled: true, focusable: false },
  ],
  transitionType: { kind: "record", fields: { id: { kind: "string" }, from: { kind: "string" }, to: { kind: "string" } } },
  transitions: [{ id: "toggle", from: "unchecked", to: "checked" }],
};

describe("evaluate", () => {
  it("evaluates literals and arithmetic", () => {
    expect(evaluate(parseExpr("1 + 2"), {})).toBe(3);
    expect(evaluate(parseExpr("(1 + 2) - 1"), {})).toBe(2);
  });

  it("evaluates implies truth table", () => {
    expect(evaluate(parseExpr("implies(true, false)"), {})).toBe(false);
    expect(evaluate(parseExpr("implies(false, false)"), {})).toBe(true);
    expect(evaluate(parseExpr("implies(false, true)"), {})).toBe(true);
    expect(evaluate(parseExpr("implies(true, true)"), {})).toBe(true);
  });

  it("evaluates member access and refs from env", () => {
    expect(evaluate(parseExpr("s.disabled"), { s: { disabled: true } })).toBe(true);
  });

  it("quantifies over the states domain using the machine context", () => {
    const expr = parseExpr("all (s in states) implies(s.disabled, not s.focusable)");
    expect(evaluate(expr, {}, { machine })).toBe(true);
  });

  it("detects a violated 'all' claim", () => {
    const badMachine: MachineContext = {
      ...machine,
      states: [...machine.states, { id: "broken", disabled: true, focusable: true }],
    };
    const expr = parseExpr("all (s in states) implies(s.disabled, not s.focusable)");
    expect(evaluate(expr, {}, { machine: badMachine })).toBe(false);
  });

  it("evaluates count", () => {
    const expr = parseExpr("count (s in states) s.disabled");
    expect(evaluate(expr, {}, { machine })).toBe(1);
  });

  it("checks transition membership against states via statesRef", () => {
    const expr = parseExpr("all (t in transitions) t.to in states");
    expect(evaluate(expr, {}, { machine })).toBe(true);
  });

  it("evaluates builtins", () => {
    expect(evaluate(parseExpr("len([1,2,3])"), {})).toBe(3);
    expect(evaluate(parseExpr("isEmpty([])"), {})).toBe(true);
    expect(evaluate(parseExpr("contains([1,2,3], 2)"), {})).toBe(true);
    expect(evaluate(parseExpr("distinct([1,2,3])"), {})).toBe(true);
    expect(evaluate(parseExpr("distinct([1,1,3])"), {})).toBe(false);
    expect(evaluate(parseExpr("sorted([1,2,3])"), {})).toBe(true);
    expect(evaluate(parseExpr("sorted([3,2,1])"), {})).toBe(false);
    expect(evaluate(parseExpr("matches('abc123', '^[a-z]+[0-9]+$')"), {})).toBe(true);
  });

  it("throws on unbound references", () => {
    expect(() => evaluate(parseExpr("missing"), {})).toThrow(/unbound reference/);
  });
});
