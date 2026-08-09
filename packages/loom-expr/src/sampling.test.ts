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
});
