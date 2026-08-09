import type { LoomType, LoomValue } from "./types.js";
import type { Domain } from "./domains.js";

export type BinOp =
  | "and"
  | "or"
  | "implies"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "in";

export type UnOp = "not" | "neg";
export type Quantifier = "all" | "any" | "count";
export type BuiltinName =
  | "len"
  | "isEmpty"
  | "contains"
  | "matches"
  | "distinct"
  | "sorted"
  | "oneOf";

/**
 * Expression AST (architecture §6.4). Total, pure, first-order by construction:
 * there is no loop/recursion node, no I/O builtin, and no user-defined-function node —
 * `quant` is the only binding form, and its lambda position is fixed.
 */
export type Expr =
  | { type: "literal"; valueType: LoomType; value: LoomValue }
  | { type: "ref"; name: string }
  /** Bare `states` / `transitions` used as an expression-level list of ids (e.g. `t.to in states`). */
  | { type: "statesRef" }
  | { type: "transitionsRef" }
  | { type: "member"; target: Expr; property: string }
  | { type: "unop"; op: UnOp; expr: Expr }
  | { type: "binop"; op: BinOp; left: Expr; right: Expr }
  | { type: "ternary"; cond: Expr; then: Expr; else: Expr }
  | { type: "quant"; quant: Quantifier; ident: string; domain: Domain; body: Expr }
  | { type: "builtin"; name: BuiltinName; args: Expr[] };
