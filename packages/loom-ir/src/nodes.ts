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
  /** Auto-fires this event whenever the named prop's value changes to equal `becomes` (never on initial mount). */
  firesWhen?: { prop: string; becomes: LoomValue };
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
// Style
// ---------------------------------------------------------------------------

/**
 * A structural claim that a stylable `part` binds a CSS `property` to a
 * named design token — a token *path* (e.g. `color.surface.default`), never
 * a raw value, the same "structural, not literal" move as node identity
 * itself. `part` is scoped to `"root"` (the component's own wrapper) or the
 * name of an existing `SlotNode` for this pass — styling a purely-internal
 * sub-element the emitters don't already render as its own DOM node would
 * require generating new structure from the IR, a separate future extension,
 * not solved speculatively here.
 */
export interface TokenRefNode extends LoomNodeEnvelope {
  kind: "token-ref";
  part: string;
  property: string;
  token: string;
}

/** A minimal, deliberately small layout intent — a subset of flex/grid, not a CSS reimplementation. */
export interface LayoutIntentNode extends LoomNodeEnvelope {
  kind: "layout-intent";
  part: string;
  display: "flex" | "grid";
  direction?: "row" | "column";
  gapToken?: string;
  align?: string;
  justify?: string;
}

/** Fills the §8 "(visual) | Chromatic | Visual regression" row: a reference frame/baseline id to diff the rendered output against. */
export interface VisualConformanceNode extends LoomNodeEnvelope {
  kind: "visual-conformance";
  reference: string;
}

export type StyleNode = TokenRefNode | LayoutIntentNode | VisualConformanceNode;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * One embedded instance of another component. `component`/`resolvedComponent`
 * is resolved once at parse time the same way `extends` refs are, but —
 * unlike `extends` — never flattened into the referencer: it stays a
 * distinct, nested tree the emitters recurse into (see composition.ts,
 * emitReact.ts, emitAngular.ts). Tree shape among sibling `uses` nodes on
 * the same component is expressed by name-reference through
 * `slotContent[*].uses`, not by nesting — the same "structural reference by
 * slug" idiom `TransitionNode.from`/`.to` already uses for states.
 */
export interface UsesNode extends LoomNodeEnvelope {
  kind: "uses";
  /** This instance's own local name — referenced by other UsesNodes' slotContent.*.uses. */
  name: string;
  /** Sibling spec slug to instantiate, resolved like `extends`. */
  component: SpecRef;
  /** The already-parsed, already-flattened tree `component` resolved to. Opaque to visit()/children(). */
  resolvedComponent: ComponentNode;
  /** Exactly one UsesNode per component must set this — the outermost embedded instance. */
  root?: boolean;
  /** Literal prop values passed to the child instance. */
  props?: Record<string, LoomValue>;
  /** Per-slot-name literal text or an ordered list of other UsesNode `name`s to nest into that slot. */
  slotContent?: Record<string, { text: string } | { uses: string[] }>;
  /** Maps this embedded child instance's declared event name to one of *this* component's own declared event names. */
  on?: Record<string, string>;
  /** Root node only: name of a bool prop on this component gating whether the composed subtree renders at all. */
  visibleWhen?: string;
}

export type CompositionNode = UsesNode;

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
  style: StyleNode[];
  composition: CompositionNode[];
  prose: ProseNode[];
}

export type LoomNode =
  | ComponentNode
  | DeclarationNode
  | MachineNode
  | ClaimNode
  | A11yNode
  | StyleNode
  | CompositionNode
  | ProseNode;

export type NodeKind = LoomNode["kind"];
