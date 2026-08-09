import type { Domain, Expr, LoomType, LoomValue } from "loom-expr";
import type { LoomNodeEnvelope, SpecRef } from "./envelope.js";

/**
 * A transition/path trigger. Keyboard bindings are deliberately not a distinct
 * node type (§5.2) — a key binding is just a transition whose trigger is a key
 * event in a context.
 */
export type Trigger =
  | { kind: "key"; key: string; context?: string }
  | { kind: "event"; name: string }
  | { kind: "pointer"; name: string };

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export interface PropNode extends LoomNodeEnvelope {
  kind: "prop";
  name: string;
  valueType: LoomType;
  defaultValue?: LoomValue;
}

export interface EventNode extends LoomNodeEnvelope {
  kind: "event";
  name: string;
  payloadType: LoomType;
}

export interface SlotNode extends LoomNodeEnvelope {
  kind: "slot";
  name: string;
}

export interface MethodNode extends LoomNodeEnvelope {
  kind: "method";
  name: string;
  params: ReadonlyArray<{ name: string; type: LoomType }>;
  returnType: LoomType;
}

export type DeclarationNode = PropNode | EventNode | SlotNode | MethodNode;

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export interface StateNode extends LoomNodeEnvelope {
  kind: "state";
  name: string;
  /** Boolean facts about the state, addressable from expressions as `s.<flag>`. */
  flags: Readonly<Record<string, boolean>>;
}

export interface TransitionNode extends LoomNodeEnvelope {
  kind: "transition";
  name: string;
  from: string;
  to: string;
  trigger: Trigger;
  guard?: Expr;
}

export interface GuardNode extends LoomNodeEnvelope {
  kind: "guard";
  name: string;
  predicate: Expr;
}

/** A decision-table row, collapsed to a guarded outcome (§5.2). */
export interface RuleNode extends LoomNodeEnvelope {
  kind: "rule";
  name: string;
  condition: Expr;
  outcome: Expr;
}

export type MachineNode = StateNode | TransitionNode | GuardNode | RuleNode;

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export interface InvariantNode extends LoomNodeEnvelope {
  kind: "invariant";
  predicate: Expr;
}

export interface PropertyNode extends LoomNodeEnvelope {
  kind: "property";
  ident: string;
  domain: Domain;
  predicate: Expr;
}

/** A behavioural scenario, reframed as a path assertion over the machine (§5.2). */
export interface PathNode extends LoomNodeEnvelope {
  kind: "path";
  from: string;
  events: Trigger[];
  to: string;
}

/** A prose claim explicitly marked non-machine-verifiable (§6.6). Never emits a test. */
export interface UnexpressibleNode extends LoomNodeEnvelope {
  kind: "unexpressible";
  claim: string;
}

export type ClaimNode = InvariantNode | PropertyNode | PathNode | UnexpressibleNode;

// ---------------------------------------------------------------------------
// A11y
// ---------------------------------------------------------------------------

export interface PatternConformanceNode extends LoomNodeEnvelope {
  kind: "pattern-conformance";
  /** Reference to the APG pattern name, e.g. "checkbox". Not re-encoded content. */
  pattern: string;
}

export interface DeltaNode extends LoomNodeEnvelope {
  kind: "delta";
  description: string;
}

export interface AriaRelationNode extends LoomNodeEnvelope {
  kind: "aria-relation";
  relation: string;
  description: string;
}

export type A11yNode = PatternConformanceNode | DeltaNode | AriaRelationNode;

// ---------------------------------------------------------------------------
// Prose (non-assertable, kept per §11.1)
// ---------------------------------------------------------------------------

export interface IntentNode extends LoomNodeEnvelope {
  kind: "intent";
  text: string;
}

export interface RationaleNode extends LoomNodeEnvelope {
  kind: "rationale";
  text: string;
}

export type ProseNode = IntentNode | RationaleNode;

// ---------------------------------------------------------------------------
// Component (root)
// ---------------------------------------------------------------------------

export interface ComponentNode extends LoomNodeEnvelope {
  kind: "component";
  name: string;
  extends: SpecRef[];
  declarations: DeclarationNode[];
  states: StateNode[];
  transitions: TransitionNode[];
  guards: GuardNode[];
  rules: RuleNode[];
  claims: ClaimNode[];
  a11y: A11yNode[];
  prose: ProseNode[];
}

export type LoomNode = ComponentNode | DeclarationNode | MachineNode | ClaimNode | A11yNode | ProseNode;

export type NodeKind = LoomNode["kind"];
