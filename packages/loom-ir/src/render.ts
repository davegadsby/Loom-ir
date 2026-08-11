import type { Expr, LoomType } from "loom-expr";
import type { ComponentNode } from "./nodes.js";
import type { NodeId } from "./envelope.js";

/**
 * The render tree: what a `ComponentNode` lowers to before either backend
 * prints it. Deliberately NOT `LoomNodeEnvelope` — no `NodeId`, absent from
 * `children()`/`visit()`, never joined to the results ledger or counted in
 * coverage. A render node is a codegen instruction, not a claim target;
 * `sourceId` (present on the two node kinds that come from something a
 * spec author named) is diagnostics-only, never identity.
 *
 * Introduced whole so later phases don't re-shape the type, but most
 * variants are inert until the phase that lowers to them:
 * - `slot` is exercised starting Phase 1b (the non-composition path).
 * - `instance`/`text`/`when`/`fragment` start Phase 1c (composition).
 * - `each` starts the iteration phase.
 */
export type RenderNode =
  | { kind: "element"; tag: string; part?: string; attrs: Attr[]; handlers: Handler[]; children: RenderNode[]; sourceId?: NodeId }
  | { kind: "text"; value: Expr }
  | {
      kind: "instance";
      name: string;
      component: ComponentNode;
      props: Record<string, Expr>;
      fills: Record<string, RenderNode[]>;
      handlers: Handler[];
      sourceId?: NodeId;
    }
  | { kind: "slot"; name: string }
  | { kind: "when"; cond: Expr; then: RenderNode[]; else?: RenderNode[] }
  | { kind: "each"; ident: string; over: Expr; key?: Expr; body: RenderNode[] }
  | { kind: "fragment"; children: RenderNode[] };

export type Attr =
  | { kind: "static"; name: string; value: string }
  | { kind: "expr"; name: string; value: Expr }
  | { kind: "class"; part: string };

export interface Handler {
  /** The native DOM event name this handler binds to (e.g. `"click"`, `"keydown"`) — Angular prints it as-is; React maps it to its camelCase synthetic-event prop name. */
  on: string;
  effects: Effect[];
  /** Only meaningful when `on === "keydown"`: restricts these effects to firing only when the pressed key matches (`KeyboardEvent.key`). A component may have at most one distinct keyed-trigger key — `checkComposition` enforces this, since both backends can only bind one `keydown` handler on a root element. */
  key?: string;
}

export type Effect =
  | { kind: "set-cell"; cell: string; from: { kind: "event-value" } | { kind: "expr"; expr: Expr } }
  | { kind: "dispatch"; event: string }
  | { kind: "emit"; event: string; payload: Record<string, Expr> }
  | { kind: "invoke"; resource: string; args: Record<string, Expr> };

/**
 * The one env definition both backends' checkers/printers should eventually
 * share, replacing the five ad-hoc environments hand-built across the two
 * emitters today (per-field validate env, React's `__env`, machine-dispatch
 * env, Angular's `envLiteral`). Not yet consumed — introduced here so its
 * shape doesn't drift once something does.
 */
export interface Scope {
  values: Record<string, LoomType>;
  bound: Record<string, LoomType>;
}
