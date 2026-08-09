import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluate, domainToArbitrary } from "loom-expr";
import type { MachineContext } from "loom-expr";
import { emitJestTests } from "./jest.js";
import { makeFixture } from "./fixtures.js";

describe("emitJestTests", () => {
  it("emits one file per component containing all invariant/property claims", () => {
    const files = emitJestTests(makeFixture());
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("widget.jest.test.ts");
  });

  it("embeds the originating node id in each test name (§5.5 join key)", () => {
    const [file] = emitJestTests(makeFixture());
    expect(file!.contents).toContain("[widget/claims/always-true] invariant");
    expect(file!.contents).toContain("[widget/claims/no-disabled-states] property");
  });

  it("does not emit a test for path or unexpressible claims (different backends)", () => {
    const [file] = emitJestTests(makeFixture());
    expect(file!.contents).not.toContain("flip-turns-on");
    expect(file!.contents).not.toContain("feels-nice");
  });

  it("imports the shared interpreter rather than transpiling expressions", () => {
    const [file] = emitJestTests(makeFixture());
    expect(file!.contents).toContain(`import { evaluate, domainToArbitrary } from "loom-expr"`);
    expect(file!.contents).toContain(`import fc from "fast-check"`);
  });

  it("the embedded machine literal matches the component's states/transitions", () => {
    const [file] = emitJestTests(makeFixture());
    expect(file!.contents).toContain('"id":"off"');
    expect(file!.contents).toContain('"id":"on"');
    expect(file!.contents).toContain('"id":"flip"');
  });

  it("the embedded predicate/domain actually run correctly through loom-expr (proves the emission is sound)", () => {
    const fixture = makeFixture();
    const invariant = fixture.claims.find((c) => c.id === "widget/claims/always-true")!;
    expect(invariant.kind).toBe("invariant");
    if (invariant.kind !== "invariant") throw new Error("unreachable");
    expect(evaluate(invariant.predicate, {})).toBe(true);

    const property = fixture.claims.find((c) => c.id === "widget/claims/no-disabled-states")!;
    expect(property.kind).toBe("property");
    if (property.kind !== "property") throw new Error("unreachable");
    const machine: MachineContext = {
      stateType: { kind: "record", fields: {} },
      states: fixture.states.map((s) => ({ id: s.name, ...s.flags })),
      transitionType: { kind: "record", fields: {} },
      transitions: fixture.transitions.map((t) => ({ id: t.name, from: t.from, to: t.to })),
    };
    const arb = domainToArbitrary(property.domain, { machine });
    fc.assert(fc.property(arb, (value) => evaluate(property.predicate, { [property.ident]: value }, { machine }) === true));
  });

  it("returns no file when the component has no invariant/property claims", () => {
    const fixture = makeFixture();
    fixture.claims = fixture.claims.filter((c) => c.kind !== "invariant" && c.kind !== "property");
    expect(emitJestTests(fixture)).toEqual([]);
  });
});
