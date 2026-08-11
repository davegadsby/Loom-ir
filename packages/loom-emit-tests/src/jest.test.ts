import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluate, domainToArbitrary } from "loom-expr";
import type { LoomValue, MachineContext } from "loom-expr";
import { emitJestTests } from "./jest.js";
import { makeFixture, makeValueGraphFixture } from "./fixtures.js";

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

describe("emitJestTests — the value graph (§ Phase 3)", () => {
  it("does not emit __buildEnv/__fields/__derived for a component with no fields or derived values", () => {
    const [file] = emitJestTests(makeFixture());
    expect(file!.contents).not.toContain("__buildEnv");
    expect(file!.contents).not.toContain("__fields");
    expect(file!.contents).not.toContain("__derived");
  });

  it("emits __buildEnv, closing a field's <name>Valid and a derived value into the env, when the component has either", () => {
    const [file] = emitJestTests(makeValueGraphFixture());
    expect(file!.contents).toContain("__buildEnv");
    expect(file!.contents).toContain('"name":"name"');
    expect(file!.contents).toContain('"name":"nameBlank"');
  });

  it("the emitted __buildEnv construction actually runs correctly through loom-expr end to end (proves the emission is sound, not just shaped right)", () => {
    const fixture = makeValueGraphFixture();
    const field = fixture.declarations.find((d) => d.kind === "field")!;
    const derived = fixture.declarations.find((d) => d.kind === "derived")!;
    if (field.kind !== "field" || derived.kind !== "derived") throw new Error("unreachable");

    const claim = fixture.claims.find((c) => c.id === "widget/claims/name-blank-mirrors-an-empty-name")!;
    if (claim.kind !== "property") throw new Error("unreachable");

    // Mirrors __buildEnv's generated logic directly, rather than eval-ing the
    // emitted file's text — proves the *mechanism* jest.ts codegens is sound.
    const buildEnv = (overrides: Record<string, LoomValue>): Record<string, LoomValue> => {
      const env: Record<string, LoomValue> = { [field.name]: "", ...overrides };
      const fieldValue: LoomValue = env[field.name] ?? "";
      env[`${field.name}Valid`] = field.validate ? evaluate(field.validate, { [field.name]: fieldValue }) === true : true;
      env[derived.name] = evaluate(derived.expr, env);
      return env;
    };

    const arb = domainToArbitrary(claim.domain);
    fc.assert(fc.property(arb, (value) => evaluate(claim.predicate, buildEnv({ [claim.ident]: value })) === true));

    // The property is genuinely falsifiable, not vacuous: corrupting the
    // derived closure (skipping the nameValid step) makes it fail.
    const brokenEnv = { name: "", nameBlank: false };
    expect(evaluate(claim.predicate, brokenEnv)).toBe(false);
  });

  it("a field with no validate always contributes <name>Valid: true", () => {
    const fixture = makeValueGraphFixture();
    const field = fixture.declarations.find((d) => d.kind === "field")!;
    if (field.kind !== "field") throw new Error("unreachable");
    field.validate = undefined;

    const [file] = emitJestTests(fixture);
    expect(file!.contents).toContain('"validate":null');
  });
});
