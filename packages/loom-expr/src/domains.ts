import type { LoomType, LoomValue } from "./types.js";
import type { Expr } from "./ast.js";

/**
 * Domain grammar (architecture §6.5). A domain must be *constructive* — the
 * sampler builds concrete values from it (see sampling.ts) — which is why the
 * language stops at this fixed set of constructors rather than admitting an
 * arbitrary predicate as a domain.
 */
export type Domain =
  | { kind: "type"; type: LoomType }
  | { kind: "oneOf"; literals: readonly LoomValue[] }
  | { kind: "range"; lo: number; hi: number }
  | { kind: "list"; of: Domain; size: { min: number; max: number } }
  /** `predicate` is evaluated with `boundIdent` bound to the candidate value. */
  | { kind: "where"; base: Domain; boundIdent: string; predicate: Expr }
  | { kind: "states" }
  | { kind: "transitions" };
