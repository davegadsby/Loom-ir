import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseDomain } from "./parser.js";
import { domainToArbitrary } from "./sampling.js";
import type { MachineContext } from "./context.js";

describe("domainToArbitrary", () => {
  it("samples within a range domain", () => {
    const arb = domainToArbitrary(parseDomain("range(0, 10)", "x"));
    fc.assert(
      fc.property(arb, (v) => typeof v === "number" && v >= 0 && v <= 10),
      { numRuns: 200 }
    );
  });

  it("samples only the literals of a oneOf domain", () => {
    const arb = domainToArbitrary(parseDomain("oneOf [1, 2, 3]", "x"));
    fc.assert(fc.property(arb, (v) => [1, 2, 3].includes(v as number)));
  });

  it("samples the machine's states domain", () => {
    const machine: MachineContext = {
      stateType: { kind: "record", fields: { id: { kind: "string" } } },
      states: [{ id: "a" }, { id: "b" }],
      transitionType: { kind: "record", fields: { id: { kind: "string" } } },
      transitions: [],
    };
    const arb = domainToArbitrary(parseDomain("states", "s"), { machine });
    fc.assert(fc.property(arb, (v) => ["a", "b"].includes((v as { id: string }).id)));
  });

  it("filters a where domain down to satisfying values only", () => {
    const arb = domainToArbitrary(parseDomain("where(range(0, 100), x > 50)", "x"));
    fc.assert(fc.property(arb, (v) => (v as number) > 50), { numRuns: 200 });
  });

  it("throws a clear error when a where domain is unsatisfiable (guard rail)", () => {
    expect(() => domainToArbitrary(parseDomain("where(range(0, 1), x > 1000)", "x"))).toThrow(/unsatisfiable/);
  });

  it("throws when a list domain's size.max is 0 (guard rail: can only ever produce the empty list)", () => {
    expect(() => domainToArbitrary(parseDomain("list<int> size(0, 0)", "x"))).toThrow(/never produce a non-empty list/);
  });

  it("does not throw for a list domain that can produce a non-empty list", () => {
    const arb = domainToArbitrary(parseDomain("list<int> size(0, 3)", "x"));
    fc.assert(fc.property(arb, (v) => Array.isArray(v)));
  });

  it("throws a clear error for an empty oneOf domain", () => {
    expect(() => domainToArbitrary({ kind: "oneOf", literals: [] })).toThrow(/no literals/);
  });
});
