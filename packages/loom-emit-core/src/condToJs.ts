import type { Expr } from "loom-expr";
import { camelCase } from "./naming.js";

/**
 * Prints a `RenderNode`'s `when.cond` as raw JS/template boolean-expression
 * source referencing already-declared local names — NOT a general Expr
 * compiler, and not the `evaluate()`-at-runtime path a `{expr}` computed prop
 * uses. `when.cond` is only ever built by lowering from two structurally
 * simple, fully-known shapes: a bare prop reference (`visibleWhen`) and a
 * `touched && !valid` field-validity gate — so this only needs to handle
 * `ref`, `unop:"not"`, and `binop:"and"`. Anything else throws, deliberately:
 * a `when.cond` that needs more than this is a sign the node came from
 * somewhere this narrow assumption no longer holds, not a case to silently
 * paper over.
 *
 * Angular's boolean template-expression syntax happens to be identical JS
 * syntax for exactly these three shapes (`&&`, `!`, a bare identifier), so
 * both backends share this one printer.
 */
export function condToJs(expr: Expr): string {
  switch (expr.type) {
    case "ref":
      return camelCase(expr.name);
    case "unop":
      if (expr.op === "not") return `!${condToJs(expr.expr)}`;
      break;
    case "binop":
      if (expr.op === "and") return `${condToJs(expr.left)} && ${condToJs(expr.right)}`;
      break;
  }
  throw new Error(`condToJs: unsupported expression shape '${expr.type}' (this printer only handles ref/not/and)`);
}
