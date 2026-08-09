import type { Expr } from "./ast.js";
import type { Domain } from "./domains.js";
import type { LoomType, LoomValue } from "./types.js";
import { typeEquals, typeToString } from "./types.js";
import type { TypecheckContext } from "./context.js";

export class TypeError extends Error {}

type Bound = Readonly<Record<string, LoomType>>;

const BOOL: LoomType = { kind: "bool" };
const INT: LoomType = { kind: "int" };
const STRING: LoomType = { kind: "string" };

function inferLiteralType(v: LoomValue): LoomType {
  if (typeof v === "boolean") return BOOL;
  if (typeof v === "number") return Number.isInteger(v) ? INT : { kind: "float" };
  if (typeof v === "string") return STRING;
  throw new TypeError(`cannot infer a domain element type from literal ${JSON.stringify(v)}`);
}

function expectNumeric(t: LoomType, where: string): void {
  if (t.kind !== "int" && t.kind !== "float") {
    throw new TypeError(`${where}: expected int or float, got ${typeToString(t)}`);
  }
}

function expect(actual: LoomType, expected: LoomType, where: string): void {
  if (!typeEquals(actual, expected)) {
    throw new TypeError(`${where}: expected ${typeToString(expected)}, got ${typeToString(actual)}`);
  }
}

export function typecheckDomain(domain: Domain, ctx: TypecheckContext, bound: Bound = {}): LoomType {
  switch (domain.kind) {
    case "type":
      return domain.type;
    case "oneOf": {
      if (domain.literals.length === 0) throw new TypeError("'oneOf' domain must have at least one literal");
      const first = inferLiteralType(domain.literals[0]!);
      for (const lit of domain.literals) {
        expect(inferLiteralType(lit), first, "'oneOf' domain literal");
      }
      return first;
    }
    case "range":
      return INT;
    case "list":
      return { kind: "list", of: typecheckDomain(domain.of, ctx, bound) };
    case "where": {
      const elementType = typecheckDomain(domain.base, ctx, bound);
      const predicateType = typecheck(domain.predicate, ctx, { ...bound, [domain.boundIdent]: elementType });
      expect(predicateType, BOOL, "'where' domain predicate");
      return elementType;
    }
    case "states":
      if (!ctx.machine) throw new TypeError("'states' domain used without a machine context");
      return ctx.machine.stateType;
    case "transitions":
      if (!ctx.machine) throw new TypeError("'transitions' domain used without a machine context");
      return ctx.machine.transitionType;
  }
}

export function typecheck(expr: Expr, ctx: TypecheckContext, bound: Bound = {}): LoomType {
  switch (expr.type) {
    case "literal":
      return expr.valueType;
    case "ref": {
      if (expr.name in bound) return bound[expr.name]!;
      if (expr.name in ctx.props) return ctx.props[expr.name]!;
      throw new TypeError(`unresolved reference: ${expr.name}`);
    }
    case "statesRef":
    case "transitionsRef":
      return { kind: "list", of: STRING };
    case "member": {
      const targetType = typecheck(expr.target, ctx, bound);
      if (targetType.kind !== "record") {
        throw new TypeError(`cannot access member '${expr.property}' on ${typeToString(targetType)}`);
      }
      const fieldType = targetType.fields[expr.property];
      if (!fieldType) throw new TypeError(`record has no field '${expr.property}'`);
      return fieldType;
    }
    case "unop": {
      const operand = typecheck(expr.expr, ctx, bound);
      if (expr.op === "not") {
        expect(operand, BOOL, "'not' operand");
        return BOOL;
      }
      expectNumeric(operand, "'-' operand");
      return operand;
    }
    case "binop":
      return typecheckBinop(expr, ctx, bound);
    case "ternary": {
      expect(typecheck(expr.cond, ctx, bound), BOOL, "ternary condition");
      const thenType = typecheck(expr.then, ctx, bound);
      const elseType = typecheck(expr.else, ctx, bound);
      expect(elseType, thenType, "ternary branches");
      return thenType;
    }
    case "quant": {
      const elementType = typecheckDomain(expr.domain, ctx, bound);
      const bodyType = typecheck(expr.body, ctx, { ...bound, [expr.ident]: elementType });
      expect(bodyType, BOOL, `'${expr.quant}' body`);
      return expr.quant === "count" ? INT : BOOL;
    }
    case "builtin":
      return typecheckBuiltin(expr, ctx, bound);
  }
}

function typecheckBinop(expr: Extract<Expr, { type: "binop" }>, ctx: TypecheckContext, bound: Bound): LoomType {
  const { op } = expr;
  if (op === "and" || op === "or" || op === "implies") {
    expect(typecheck(expr.left, ctx, bound), BOOL, `'${op}' left operand`);
    expect(typecheck(expr.right, ctx, bound), BOOL, `'${op}' right operand`);
    return BOOL;
  }
  if (op === "==" || op === "!=") {
    const l = typecheck(expr.left, ctx, bound);
    const r = typecheck(expr.right, ctx, bound);
    expect(r, l, `'${op}' operands`);
    return BOOL;
  }
  if (op === "<" || op === "<=" || op === ">" || op === ">=") {
    const l = typecheck(expr.left, ctx, bound);
    const r = typecheck(expr.right, ctx, bound);
    expectNumeric(l, `'${op}' left operand`);
    expectNumeric(r, `'${op}' right operand`);
    return BOOL;
  }
  if (op === "+" || op === "-") {
    const l = typecheck(expr.left, ctx, bound);
    const r = typecheck(expr.right, ctx, bound);
    expectNumeric(l, `'${op}' left operand`);
    expectNumeric(r, `'${op}' right operand`);
    return l.kind === "float" || r.kind === "float" ? { kind: "float" } : INT;
  }
  // op === "in"
  const elementType = typecheck(expr.left, ctx, bound);
  const listType = typecheck(expr.right, ctx, bound);
  if (listType.kind !== "list") throw new TypeError(`right-hand side of 'in' must be a list, got ${typeToString(listType)}`);
  expect(listType.of, elementType, "'in' element type");
  return BOOL;
}

function typecheckBuiltin(expr: Extract<Expr, { type: "builtin" }>, ctx: TypecheckContext, bound: Bound): LoomType {
  const argTypes = expr.args.map((a) => typecheck(a, ctx, bound));
  switch (expr.name) {
    case "len":
      if (argTypes[0]!.kind !== "list" && argTypes[0]!.kind !== "string") {
        throw new TypeError(`'len' expects a list or string, got ${typeToString(argTypes[0]!)}`);
      }
      return INT;
    case "isEmpty":
      if (argTypes[0]!.kind !== "list" && argTypes[0]!.kind !== "string") {
        throw new TypeError(`'isEmpty' expects a list or string, got ${typeToString(argTypes[0]!)}`);
      }
      return BOOL;
    case "contains": {
      const listType = argTypes[0]!;
      if (listType.kind !== "list") throw new TypeError(`'contains' expects a list, got ${typeToString(listType)}`);
      expect(argTypes[1]!, listType.of, "'contains' element");
      return BOOL;
    }
    case "oneOf": {
      const listType = argTypes[1]!;
      if (listType.kind !== "list") throw new TypeError(`'oneOf' expects a list as its 2nd argument, got ${typeToString(listType)}`);
      expect(argTypes[0]!, listType.of, "'oneOf' element");
      return BOOL;
    }
    case "matches":
      expect(argTypes[0]!, STRING, "'matches' subject");
      expect(argTypes[1]!, STRING, "'matches' pattern");
      return BOOL;
    case "distinct":
      if (argTypes[0]!.kind !== "list") throw new TypeError(`'distinct' expects a list, got ${typeToString(argTypes[0]!)}`);
      return BOOL;
    case "sorted": {
      const listType = argTypes[0]!;
      if (listType.kind !== "list") throw new TypeError(`'sorted' expects a list, got ${typeToString(listType)}`);
      expectNumeric(listType.of, "'sorted' element type");
      return BOOL;
    }
  }
}
