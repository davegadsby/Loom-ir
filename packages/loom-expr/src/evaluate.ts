import type { Expr } from "./ast.js";
import type { Domain } from "./domains.js";
import type { Env, MachineContext } from "./context.js";
import type { LoomValue } from "./types.js";

export interface EvalContext {
  machine?: MachineContext;
}

function asRecord(v: LoomValue, property: string): Readonly<Record<string, LoomValue>> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`cannot access member '${property}' on non-record value ${JSON.stringify(v)}`);
  }
  return v;
}

function idOf(v: LoomValue): LoomValue {
  return asRecord(v, "id")["id"] ?? null;
}

/**
 * Enumerates a *finite, compile-time-enumerable* domain. `list` and `where`
 * domains are for sampling (see sampling.ts) — evaluate() only needs to walk
 * domains that can appear as the target of a quantifier in a closed
 * (no-free-variable) claim, e.g. an InvariantNode predicate like
 * `all (s in states) implies(s.disabled, not s.focusable)`.
 */
export function enumerateDomain(domain: Domain, ctx: EvalContext): LoomValue[] {
  switch (domain.kind) {
    case "oneOf":
      return [...domain.literals];
    case "range": {
      const out: LoomValue[] = [];
      for (let i = domain.lo; i <= domain.hi; i++) out.push(i);
      return out;
    }
    case "states":
      if (!ctx.machine) throw new Error("'states' domain used without a machine context");
      return [...ctx.machine.states];
    case "transitions":
      if (!ctx.machine) throw new Error("'transitions' domain used without a machine context");
      return [...ctx.machine.transitions];
    case "type":
    case "list":
    case "where":
      throw new Error(
        `domain kind '${domain.kind}' is not compile-time enumerable; it may only be sampled (see sampling.ts)`
      );
  }
}

export function evaluate(expr: Expr, env: Env, ctx: EvalContext = {}): LoomValue {
  switch (expr.type) {
    case "literal":
      return expr.value;
    case "ref": {
      if (!(expr.name in env)) throw new Error(`unbound reference: ${expr.name}`);
      return env[expr.name] as LoomValue;
    }
    case "statesRef":
      if (!ctx.machine) throw new Error("'states' used without a machine context");
      return ctx.machine.states.map(idOf);
    case "transitionsRef":
      if (!ctx.machine) throw new Error("'transitions' used without a machine context");
      return ctx.machine.transitions.map(idOf);
    case "member": {
      const target = evaluate(expr.target, env, ctx);
      const record = asRecord(target, expr.property);
      if (!(expr.property in record)) {
        throw new Error(`record has no field '${expr.property}'`);
      }
      return record[expr.property] as LoomValue;
    }
    case "unop": {
      const v = evaluate(expr.expr, env, ctx);
      if (expr.op === "not") return !(v as boolean);
      return -(v as number);
    }
    case "binop":
      return evalBinop(expr, env, ctx);
    case "ternary":
      return evaluate(expr.cond, env, ctx) ? evaluate(expr.then, env, ctx) : evaluate(expr.else, env, ctx);
    case "quant":
      return evalQuant(expr, env, ctx);
    case "builtin":
      return evalBuiltin(expr, env, ctx);
  }
}

function evalBinop(expr: Extract<Expr, { type: "binop" }>, env: Env, ctx: EvalContext): LoomValue {
  if (expr.op === "and") return (evaluate(expr.left, env, ctx) as boolean) && (evaluate(expr.right, env, ctx) as boolean);
  if (expr.op === "or") return (evaluate(expr.left, env, ctx) as boolean) || (evaluate(expr.right, env, ctx) as boolean);
  if (expr.op === "implies") return !(evaluate(expr.left, env, ctx) as boolean) || (evaluate(expr.right, env, ctx) as boolean);

  const l = evaluate(expr.left, env, ctx);
  const r = evaluate(expr.right, env, ctx);
  switch (expr.op) {
    case "==":
      return deepEquals(l, r);
    case "!=":
      return !deepEquals(l, r);
    case "<":
      return (l as number) < (r as number);
    case "<=":
      return (l as number) <= (r as number);
    case ">":
      return (l as number) > (r as number);
    case ">=":
      return (l as number) >= (r as number);
    case "+":
      return (l as number) + (r as number);
    case "-":
      return (l as number) - (r as number);
    case "in":
      if (!Array.isArray(r)) throw new Error("right-hand side of 'in' must be a list");
      return r.some((x) => deepEquals(x, l));
  }
}

function evalQuant(expr: Extract<Expr, { type: "quant" }>, env: Env, ctx: EvalContext): LoomValue {
  const elements = enumerateDomain(expr.domain, ctx);
  if (expr.quant === "count") {
    return elements.filter((el) => evaluate(expr.body, { ...env, [expr.ident]: el }, ctx) as boolean).length;
  }
  const predicate = (el: LoomValue) => evaluate(expr.body, { ...env, [expr.ident]: el }, ctx) as boolean;
  if (expr.quant === "all") return elements.every(predicate);
  return elements.some(predicate);
}

function evalBuiltin(expr: Extract<Expr, { type: "builtin" }>, env: Env, ctx: EvalContext): LoomValue {
  const args = expr.args.map((a) => evaluate(a, env, ctx));
  switch (expr.name) {
    case "len":
      return (args[0] as LoomValue[] | string).length;
    case "isEmpty":
      return (args[0] as LoomValue[] | string).length === 0;
    case "contains":
      return (args[0] as LoomValue[]).some((x) => deepEquals(x, args[1] as LoomValue));
    case "oneOf":
      return (args[1] as LoomValue[]).some((x) => deepEquals(x, args[0] as LoomValue));
    case "matches":
      return new RegExp(args[1] as string).test(args[0] as string);
    case "distinct": {
      const list = args[0] as LoomValue[];
      return list.every((x, i) => list.findIndex((y) => deepEquals(x, y)) === i);
    }
    case "sorted": {
      const list = args[0] as number[];
      return list.every((x, i) => i === 0 || (list[i - 1] as number) <= x);
    }
  }
}

function deepEquals(a: LoomValue, b: LoomValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEquals(x, b[i] as LoomValue));
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((k, i) => k === bKeys[i] && deepEquals(a[k] as LoomValue, b[k] as LoomValue))
    );
  }
  return false;
}
