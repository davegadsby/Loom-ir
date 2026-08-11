import type { BinOp, BuiltinName, Expr } from "loom-expr";

/**
 * Resolves a `ref` name (a declared prop/field/resource/derived name, or an
 * `each`-bound ident) to the JS expression that currently holds it —
 * `checked` might mean the bare local `checked` (React) or `this.checked`
 * (Angular class member), and a field's own name means its `<name>Value`
 * local/member, never the field's own name literally. Each emitter builds
 * its own resolver reflecting its own naming/scoping conventions (mirroring
 * the emitter-specific `envLiteral`/`valueEnvParts` this replaces); this
 * compiler only ever consults it, never assumes a naming scheme itself.
 * Should throw for a name it can't resolve — the same "this shape is out of
 * bounds, don't silently emit nonsense" discipline `condToJs` already uses.
 */
export type RefResolver = (name: string) => string;

/**
 * Compiles a component-level `Expr` (a `FieldNode.validate`, a `derived`
 * value's own `expr`, or a composed `{expr}` prop) directly to a JS
 * expression string — the replacement for building an env object and
 * calling `evaluate(exprJson, env)` against it at runtime. The compiled
 * output references already-declared local variables/class members
 * (via `resolveRef`) instead of an env object, so a component using only
 * these three mechanisms no longer needs to import `loom-expr`'s
 * interpreter or ship the raw `Expr` JSON at all.
 *
 * Deliberately does NOT cover `quant`/`statesRef`/`transitionsRef` — those
 * only make sense inside a claim's `states`/`transitions` domain, which no
 * `FieldNode.validate`/`derived.expr`/computed `{expr}` prop has ever
 * needed (confirmed: no example spec's component-level expr uses them, and
 * `checkComposition`'s own typecheck context for these three contexts never
 * includes a machine domain). Reaching one of those throws, the same
 * "narrower than the interpreter, on purpose" boundary `condToJs` already
 * draws for its own smaller shape. Claims themselves are unaffected by this
 * compiler — `loom-emit-tests` keeps evaluating claim predicates via the
 * interpreter, since generated tests are dev-time-only and never shipped.
 *
 * `==`/`!=`/`in`/`contains`/`oneOf` compile to JS's own `===`/`.includes()`
 * — correct for every primitive (`bool`/`int`/`float`/`string`/`enum`)
 * comparison, which is everything any current component-level expr
 * compares. The interpreter's own `deepEquals` additionally handles
 * record/list-valued equality structurally; nothing here does, since no
 * component-level expr has ever needed it. A future one that does would
 * need this compiler to grow a structural-equality helper, not silently
 * get a wrong answer — flagged here rather than guarded at runtime because
 * this compiler has no type information to detect the case reliably.
 */
export function compileExprToJs(expr: Expr, resolveRef: RefResolver): string {
  switch (expr.type) {
    case "literal":
      return JSON.stringify(expr.value);
    case "ref":
      return resolveRef(expr.name);
    case "member":
      return `${compileExprToJs(expr.target, resolveRef)}.${expr.property}`;
    case "unop":
      return expr.op === "not"
        ? `!(${compileExprToJs(expr.expr, resolveRef)})`
        : `-(${compileExprToJs(expr.expr, resolveRef)})`;
    case "binop":
      return compileBinop(expr.op, compileExprToJs(expr.left, resolveRef), compileExprToJs(expr.right, resolveRef));
    case "ternary":
      return `(${compileExprToJs(expr.cond, resolveRef)} ? ${compileExprToJs(expr.then, resolveRef)} : ${compileExprToJs(expr.else, resolveRef)})`;
    case "builtin":
      return compileBuiltin(
        expr.name,
        expr.args.map((a) => compileExprToJs(a, resolveRef))
      );
    case "quant":
    case "statesRef":
    case "transitionsRef":
      throw new Error(
        `compileExprToJs: '${expr.type}' requires a claim's machine context — not supported for a component-level expression (FieldNode.validate/derived.expr/a composed {expr} prop)`
      );
  }
}

function compileBinop(op: BinOp, l: string, r: string): string {
  switch (op) {
    case "and":
      return `(${l} && ${r})`;
    case "or":
      return `(${l} || ${r})`;
    case "implies":
      return `(!(${l}) || ${r})`;
    case "==":
      return `(${l} === ${r})`;
    case "!=":
      return `(${l} !== ${r})`;
    case "<":
      return `(${l} < ${r})`;
    case "<=":
      return `(${l} <= ${r})`;
    case ">":
      return `(${l} > ${r})`;
    case ">=":
      return `(${l} >= ${r})`;
    case "+":
      return `(${l} + ${r})`;
    case "-":
      return `(${l} - ${r})`;
    case "in":
      return `(${r}).includes(${l})`;
  }
}

function compileBuiltin(name: BuiltinName, args: readonly string[]): string {
  switch (name) {
    case "len":
      return `(${args[0]}).length`;
    case "isEmpty":
      return `(${args[0]}).length === 0`;
    case "matches":
      return `new RegExp(${args[1]}).test(${args[0]})`;
    case "contains":
      return `(${args[0]}).includes(${args[1]})`;
    case "oneOf":
      return `(${args[1]}).includes(${args[0]})`;
    case "distinct":
      return `(${args[0]}).every((x, i, a) => a.indexOf(x) === i)`;
    case "sorted":
      return `(${args[0]}).every((x, i, a) => i === 0 || a[i - 1] <= x)`;
  }
}
