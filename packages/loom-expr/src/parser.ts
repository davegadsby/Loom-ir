import { tokenize } from "./lexer.js";
import type { Token, TokenType } from "./lexer.js";
import type { BinOp, BuiltinName, Expr, Quantifier } from "./ast.js";
import type { Domain } from "./domains.js";
import type { LoomValue } from "./types.js";

const BUILTIN_NAMES: readonly BuiltinName[] = [
  "len",
  "isEmpty",
  "contains",
  "matches",
  "distinct",
  "sorted",
  "oneOf",
];

const PRIMITIVE_TYPE_KEYWORDS = ["bool", "int", "float", "string"] as const;

class Parser {
  private tokens: Token[];
  private index = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private identIs(text: string): boolean {
    const t = this.peek();
    return t.type === "ident" && t.text === text;
  }

  private typeIs(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    const t = this.peek();
    if (t.type !== "eof") this.index++;
    return t;
  }

  private expectType(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) throw new Error(`expected '${type}' at position ${t.pos}, got '${t.text || "<eof>"}'`);
    return this.advance();
  }

  private expectIdent(text: string): Token {
    if (!this.identIs(text)) {
      const t = this.peek();
      throw new Error(`expected '${text}' at position ${t.pos}, got '${t.text || "<eof>"}'`);
    }
    return this.advance();
  }

  parseExprEntry(): Expr {
    const expr = this.parseExpr();
    this.expectType("eof");
    return expr;
  }

  parseDomainEntry(boundIdent: string): Domain {
    const domain = this.parseDomainClause(boundIdent);
    this.expectType("eof");
    return domain;
  }

  parseQuantifiedClaimEntry(): { ident: string; domain: Domain; body: Expr } {
    const clause = this.parseBinderClause();
    const body = this.parseExpr();
    this.expectType("eof");
    return { ...clause, body };
  }

  /** `'(' ident 'in' domain ')'` */
  private parseBinderClause(): { ident: string; domain: Domain } {
    this.expectType("(");
    const ident = this.expectType("ident").text;
    this.expectIdent("in");
    const domain = this.parseDomainClause(ident);
    this.expectType(")");
    return { ident, domain };
  }

  parseExpr(): Expr {
    return this.parseTernary();
  }

  private parseTernary(): Expr {
    const cond = this.parseImplies();
    if (this.typeIs("?")) {
      this.advance();
      const then = this.parseExpr();
      this.expectType(":");
      const els = this.parseExpr();
      return { type: "ternary", cond, then, else: els };
    }
    return cond;
  }

  private parseImplies(): Expr {
    const left = this.parseOr();
    if (this.identIs("implies")) {
      this.advance();
      const right = this.parseImplies();
      return { type: "binop", op: "implies", left, right };
    }
    return left;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.identIs("or")) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "binop", op: "or", left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.identIs("and")) {
      this.advance();
      const right = this.parseNot();
      left = { type: "binop", op: "and", left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.identIs("not")) {
      this.advance();
      return { type: "unop", op: "not", expr: this.parseNot() };
    }
    return this.parseComparison();
  }

  private static readonly COMPARISON_TOKENS: TokenType[] = ["==", "!=", "<", "<=", ">", ">="];

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const t = this.peek();
    if (Parser.COMPARISON_TOKENS.includes(t.type)) {
      this.advance();
      const right = this.parseAdditive();
      return { type: "binop", op: t.type as BinOp, left, right };
    }
    if (this.identIs("in")) {
      this.advance();
      const right = this.parseAdditive();
      return { type: "binop", op: "in", left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseUnary();
    while (this.typeIs("+") || this.typeIs("-")) {
      const op = this.advance().type as "+" | "-";
      const right = this.parseUnary();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.typeIs("-")) {
      this.advance();
      return { type: "unop", op: "neg", expr: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    while (this.typeIs(".")) {
      this.advance();
      const property = this.expectType("ident").text;
      expr = { type: "member", target: expr, property };
    }
    return expr;
  }

  private parseArgs(): Expr[] {
    this.expectType("(");
    const args: Expr[] = [];
    if (!this.typeIs(")")) {
      args.push(this.parseExpr());
      while (this.typeIs(",")) {
        this.advance();
        args.push(this.parseExpr());
      }
    }
    this.expectType(")");
    return args;
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.type === "number") {
      this.advance();
      const value = Number(t.text);
      return { type: "literal", valueType: t.text.includes(".") ? { kind: "float" } : { kind: "int" }, value };
    }
    if (t.type === "string") {
      this.advance();
      return { type: "literal", valueType: { kind: "string" }, value: t.text };
    }
    if (t.type === "(") {
      this.advance();
      const expr = this.parseExpr();
      this.expectType(")");
      return expr;
    }
    if (t.type === "[") {
      return this.parseListLiteral();
    }
    if (t.type === "ident") {
      if (t.text === "true" || t.text === "false") {
        this.advance();
        return { type: "literal", valueType: { kind: "bool" }, value: t.text === "true" };
      }
      if ((t.text === "all" || t.text === "any" || t.text === "count") && this.tokens[this.index + 1]?.type === "(") {
        return this.parseQuant(t.text as Quantifier);
      }
      // `implies(a, b)` call sugar for the infix form, matching architecture §6.5 usage.
      if (t.text === "implies" && this.tokens[this.index + 1]?.type === "(") {
        this.advance();
        const args = this.parseArgs();
        if (args.length !== 2) throw new Error(`'implies(...)' expects exactly 2 arguments, got ${args.length}`);
        return { type: "binop", op: "implies", left: args[0]!, right: args[1]! };
      }
      if ((BUILTIN_NAMES as readonly string[]).includes(t.text) && this.tokens[this.index + 1]?.type === "(") {
        this.advance();
        const args = this.parseArgs();
        return { type: "builtin", name: t.text as BuiltinName, args };
      }
      if (t.text === "states") {
        this.advance();
        return { type: "statesRef" };
      }
      if (t.text === "transitions") {
        this.advance();
        return { type: "transitionsRef" };
      }
      this.advance();
      return { type: "ref", name: t.text };
    }
    throw new Error(`unexpected token '${t.text || "<eof>"}' at position ${t.pos}`);
  }

  private parseListLiteral(): Expr {
    this.expectType("[");
    const elements: Expr[] = [];
    if (!this.typeIs("]")) {
      elements.push(this.parseExpr());
      while (this.typeIs(",")) {
        this.advance();
        elements.push(this.parseExpr());
      }
    }
    this.expectType("]");
    const values: LoomValue[] = elements.map((e) => {
      if (e.type !== "literal") throw new Error("list literal elements must themselves be literals");
      return e.value;
    });
    const of = elements[0]?.type === "literal" ? elements[0].valueType : { kind: "string" as const };
    return { type: "literal", valueType: { kind: "list", of }, value: values };
  }

  private parseQuant(quant: Quantifier): Expr {
    this.advance(); // consume all/any/count
    const { ident, domain } = this.parseBinderClause();
    const body = this.parseExpr();
    return { type: "quant", quant, ident, domain, body };
  }

  /** Domain grammar (§6.5), concretized with parens/brackets as the surface syntax. */
  private parseDomainClause(boundIdent: string): Domain {
    if (this.identIs("oneOf")) {
      this.advance();
      this.expectType("[");
      const literals: LoomValue[] = [];
      if (!this.typeIs("]")) {
        literals.push(this.parseLiteralValue());
        while (this.typeIs(",")) {
          this.advance();
          literals.push(this.parseLiteralValue());
        }
      }
      this.expectType("]");
      return { kind: "oneOf", literals };
    }
    if (this.identIs("range")) {
      this.advance();
      this.expectType("(");
      const lo = this.parseSignedNumber();
      this.expectType(",");
      const hi = this.parseSignedNumber();
      this.expectType(")");
      return { kind: "range", lo, hi };
    }
    if (this.identIs("list")) {
      this.advance();
      this.expectType("<");
      const of = this.parseDomainClause(boundIdent);
      this.expectType(">");
      this.expectIdent("size");
      this.expectType("(");
      const min = this.parseSignedNumber();
      this.expectType(",");
      const max = this.parseSignedNumber();
      this.expectType(")");
      return { kind: "list", of, size: { min, max } };
    }
    if (this.identIs("where")) {
      this.advance();
      this.expectType("(");
      const base = this.parseDomainClause(boundIdent);
      this.expectType(",");
      const predicate = this.parseExpr();
      this.expectType(")");
      return { kind: "where", base, boundIdent, predicate };
    }
    if (this.identIs("states")) {
      this.advance();
      return { kind: "states" };
    }
    if (this.identIs("transitions")) {
      this.advance();
      return { kind: "transitions" };
    }
    for (const kw of PRIMITIVE_TYPE_KEYWORDS) {
      if (this.identIs(kw)) {
        this.advance();
        return { kind: "type", type: { kind: kw } };
      }
    }
    const t = this.peek();
    throw new Error(`unknown domain '${t.text || "<eof>"}' at position ${t.pos}`);
  }

  private parseLiteralValue(): LoomValue {
    const t = this.peek();
    if (t.type === "number") {
      this.advance();
      return Number(t.text);
    }
    if (t.type === "string") {
      this.advance();
      return t.text;
    }
    if (t.type === "ident" && (t.text === "true" || t.text === "false")) {
      this.advance();
      return t.text === "true";
    }
    if (t.type === "-") {
      this.advance();
      return -(this.parseLiteralValue() as number);
    }
    throw new Error(`expected a literal at position ${t.pos}, got '${t.text || "<eof>"}'`);
  }

  private parseSignedNumber(): number {
    const negative = this.typeIs("-");
    if (negative) this.advance();
    const t = this.expectType("number");
    const n = Number(t.text);
    return negative ? -n : n;
  }
}

export function parseExpr(source: string): Expr {
  return new Parser(source).parseExprEntry();
}

export function parseDomain(source: string, boundIdent: string): Domain {
  return new Parser(source).parseDomainEntry(boundIdent);
}

/** Parses `(ident in domain) body` — the shape a PropertyNode's claim is written in. */
export function parseQuantifiedClaim(source: string): { ident: string; domain: Domain; body: Expr } {
  return new Parser(source).parseQuantifiedClaimEntry();
}
