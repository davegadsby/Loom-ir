export type { LoomType, LoomValue } from "./types.js";
export { typeEquals, typeToString } from "./types.js";

export type { Expr, BinOp, UnOp, Quantifier, BuiltinName } from "./ast.js";
export type { Domain } from "./domains.js";
export type { MachineContext, TypecheckContext, Env } from "./context.js";

export { parseExpr, parseDomain, parseQuantifiedClaim } from "./parser.js";
export { typecheck, typecheckDomain, TypeError } from "./typecheck.js";
export { evaluate, enumerateDomain } from "./evaluate.js";
export type { EvalContext } from "./evaluate.js";
export { domainToArbitrary, arbitraryForType } from "./sampling.js";
export type { SamplingContext } from "./sampling.js";

export { LoomMachine, Transition, Guard } from "./machine.js";
export type { MachineConfig, StateConfig, TransitionConfig, TriggerConfig } from "./machine.js";
