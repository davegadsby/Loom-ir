import type { LoomType, LoomValue } from "./types.js";

/**
 * Concrete machine data supplied by the caller (loom-ir / loom-parser) when an
 * expression quantifies over `states` or `transitions` (§6.5). loom-expr stays
 * decoupled from the node taxonomy: it only needs a record type + concrete
 * record values for each.
 */
export interface MachineContext {
  stateType: LoomType;
  states: readonly LoomValue[];
  transitionType: LoomType;
  transitions: readonly LoomValue[];
}

/** Static typing context: prop types in scope, plus the machine shape if present. */
export interface TypecheckContext {
  props: Readonly<Record<string, LoomType>>;
  machine?: MachineContext;
}

/** Runtime environment for `evaluate`: bound identifier -> value. */
export type Env = Readonly<Record<string, LoomValue>>;
