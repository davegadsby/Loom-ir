import fc from "fast-check";
import type { Domain } from "./domains.js";
import type { LoomType, LoomValue } from "./types.js";
import type { Env, MachineContext } from "./context.js";
import { evaluate } from "./evaluate.js";

export interface SamplingContext {
  machine?: MachineContext;
  /** Extra bindings already in scope, e.g. an outer quantifier's bound variable. */
  env?: Env;
}

const WHERE_SATISFIABILITY_ATTEMPTS = 1000;

export function arbitraryForType(t: LoomType): fc.Arbitrary<LoomValue> {
  switch (t.kind) {
    case "bool":
      return fc.boolean();
    case "int":
      return fc.integer();
    case "float":
      return fc.double({ noNaN: true });
    case "string":
      return fc.string();
    case "enum":
      return fc.constantFrom(...t.values);
    case "list":
      return fc.array(arbitraryForType(t.of)) as fc.Arbitrary<LoomValue>;
    case "option":
      return fc.option(arbitraryForType(t.of), { nil: null }) as fc.Arbitrary<LoomValue>;
    case "record": {
      const shape: Record<string, fc.Arbitrary<LoomValue>> = {};
      for (const [k, v] of Object.entries(t.fields)) shape[k] = arbitraryForType(v);
      return fc.record(shape) as fc.Arbitrary<LoomValue>;
    }
    case "ref":
      throw new Error(
        `ref<${t.of}> types are not directly sampleable; use the 'states'/'transitions' domain instead`
      );
  }
}

/**
 * Compiles a Domain (§6.5) into a fast-check arbitrary. This is the load-bearing
 * function behind "if a domain cannot be sampled, the property cannot be tested" —
 * every Domain variant must terminate here in a real fc.Arbitrary.
 */
export function domainToArbitrary(domain: Domain, ctx: SamplingContext = {}): fc.Arbitrary<LoomValue> {
  switch (domain.kind) {
    case "type":
      return arbitraryForType(domain.type);
    case "oneOf":
      return fc.constantFrom(...domain.literals);
    case "range":
      return fc.integer({ min: domain.lo, max: domain.hi });
    case "list": {
      const inner = domainToArbitrary(domain.of, ctx);
      return fc.array(inner, { minLength: domain.size.min, maxLength: domain.size.max });
    }
    case "where": {
      const base = domainToArbitrary(domain.base, ctx);
      const satisfies = (v: LoomValue): boolean =>
        evaluate(domain.predicate, { ...(ctx.env ?? {}), [domain.boundIdent]: v }, { machine: ctx.machine }) as boolean;
      // Guard rail (§6.5): fail loudly at compile time rather than let a
      // near-empty filtered domain starve the sampler in CI.
      const samples = fc.sample(base, WHERE_SATISFIABILITY_ATTEMPTS);
      if (!samples.some(satisfies)) {
        throw new Error(
          `'where' domain unsatisfiable: no value satisfied the predicate in ${WHERE_SATISFIABILITY_ATTEMPTS} sampling attempts`
        );
      }
      return base.filter(satisfies);
    }
    case "states":
      if (!ctx.machine) throw new Error("'states' domain used without a machine context");
      return fc.constantFrom(...ctx.machine.states);
    case "transitions":
      if (!ctx.machine) throw new Error("'transitions' domain used without a machine context");
      return fc.constantFrom(...ctx.machine.transitions);
  }
}
