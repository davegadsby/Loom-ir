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
  /**
   * Fires this event directly off a DOM trigger on this component's own
   * root element — the same `Trigger` shape a `TransitionNode` uses, so a
   * plain (machine-less) leaf like `button` can declare "`press` fires on
   * click" without needing a whole machine just to react to one
   * interaction. Two kinds are wired up by either emitter today:
   * `kind: "event"` (a named DOM event) and `kind: "key"` (a `keydown`,
   * filtered to that one key — `lowerRootHandlers` also adds `tabIndex={0}`/
   * `tabindex="0"` to the root whenever a `key` trigger is present, since a
   * keydown handler is inert on an unfocusable element; actually moving
   * focus there — autofocus-on-open, a focus trap — is separate,
   * out-of-scope work). `kind: "pointer"` stays declarable but inert, same
   * as before this field existed. A component may declare at most one
   * *distinct* keyboard-trigger key across all its events (checked by
   * `checkComposition`) — both backends can only bind one `keydown` handler
   * per root element. Payload is always empty (`{}`) — a triggered event's
   * own `payloadType` must therefore be `record{}` with no fields (checked
   * by `checkComposition`); sourcing a real payload from DOM/component
   * state is a bigger mechanism this doesn't attempt.
   */
  trigger?: Trigger;
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

/**
 * A native, locally-managed text input — unlike `PropNode`, its current
 * value is never parent-controlled; the component that declares it renders
 * a real `<input>` bound to its own local state. `validate` is evaluated
 * against an env containing only this field's own current value bound
 * under its own `name`; the derived `<name>Valid` boolean it produces is
 * available to that same component's `UsesNode.props` `{ expr }` values
 * (§ Composition) — the mechanism that lets e.g. a composed Login button's
 * `disabled` prop be computed from two sibling fields' live validity.
 */
export interface FieldNode extends LoomNodeEnvelope {
  kind: "field";
  name: string;
  /** Renders type="password" instead of type="text". */
  secret?: boolean;
  /** Defaults to "" if omitted. */
  initialValue?: string;
  /** Evaluated against `{ [name]: currentValue }`. Omitted means always valid. */
  validate?: Expr;
  /** Shown once the field has been touched (the user has typed into it) and validate() is currently false. */
  invalidMessage?: string;
}

/**
 * A named, typed value computed from this component's own props and fields
 * — never rendered on its own, but addressable (`component/declarations/<slug>`,
 * same as any other declaration), so a claim can eventually reference it by
 * name once the claim language reaches the value graph. Unlike an anonymous
 * `{ expr }` computed `UsesNode` prop (§ Composition), which is scoped to one
 * composed instance, a `DerivedNode` is named once and can be referenced from
 * multiple places — including a composed prop's own `{ expr }`, by name,
 * instead of repeating the expression. `expr` is checked against this
 * component's own props/fields only, never another `DerivedNode` — avoids
 * needing a dependency ordering or cycle check in this first pass.
 *
 * Known gap: `name` follows the same kebab-case slug convention every other
 * declaration uses, but `loom-expr`'s identifier lexer has no hyphen in its
 * grammar — `parseExpr("submit-disabled")` parses as the binop
 * `submit - disabled`, not a single ref, and fails to typecheck as an
 * unresolved reference. A multi-word `derived` name can therefore never
 * actually be *referenced* from expression text (only declared) until that's
 * addressed. This isn't new here — it silently affects any kebab-case prop
 * or field name too, just unexercised until something needed referencing
 * one from expression text. Not fixed in this pass; name a `derived` value
 * you intend to reference elsewhere as a single word for now.
 */
export interface DerivedNode extends LoomNodeEnvelope {
  kind: "derived";
  name: string;
  valueType: LoomType;
  expr: Expr;
}

/**
 * A named, typed async value the consumer provides as a 0-or-1-element
 * list — "not yet loaded" is the empty list, "loaded" is one element.
 * Deliberately `list<dataType>`, never `option<T>`: `list<T>` already
 * works end to end through the domain grammar/typecheck/evaluate/sampling
 * machinery (`task-list`'s `tasks` proved it — § Phase 4), while
 * `option<T>` would need a null literal, option-aware `==`, and narrowing
 * — real, separate `loom-expr` parser/typecheck/evaluate work that would
 * also have to reship through `loom-emit-tests`' embedded interpreter.
 *
 * This pass gives `resource` the exact runtime shape a plain `list<T>`
 * prop already has — a consumer-provided `@Input()`/prop defaulting to
 * `[]`, nothing internally generated or fetched. What makes it a
 * `resource` and not a `prop` is purely the *kind*: a distinctly-named,
 * addressable declaration the value graph (a `derived` value, a claim)
 * can reach as `list<dataType>`, the same mechanism `task-list`'s
 * `nonempty` already reaches `tasks` through. Actually performing an
 * async fetch — an `invoke` effect (declared inert in `render.ts` since
 * `RenderNode` was introduced whole), a loading flag, an error state — is
 * explicitly out of scope for this pass; see `AGENTS.md`'s Known Gaps.
 */
export interface ResourceNode extends LoomNodeEnvelope {
  kind: "resource";
  name: string;
  dataType: LoomType;
}

export type DeclarationNode = PropNode | EventNode | SlotNode | MethodNode | FieldNode | DerivedNode | ResourceNode;

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

/** A behavioural scenario: an assertion that a specific event sequence, fired from one declared state, lands in another (§5.2). */
export interface ScenarioNode extends LoomNodeEnvelope {
  kind: "scenario";
  from: string;
  events: Trigger[];
  to: string;
}

/** A prose claim explicitly marked non-machine-verifiable (§6.6). Never emits a test. */
export interface UnexpressibleNode extends LoomNodeEnvelope {
  kind: "unexpressible";
  claim: string;
}

export type ClaimNode = InvariantNode | PropertyNode | ScenarioNode | UnexpressibleNode;

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
/** A literal value, or a live-computed value sourced from this component's own current field/prop state at render time. */
export type PropValue = LoomValue | { expr: Expr };

/**
 * One fired-event target for an `on` wire: `event` is one of *this*
 * component's own declared event names; `payload` maps that event's
 * declared `payloadType` record fields to a source name — a sibling
 * `FieldNode` name or one of this component's own prop names.
 */
export interface OnWireTarget {
  event: string;
  payload?: Record<string, string>;
}
/** A bare string is sugar for `{ event: string }` — an empty-payload forward, the only shape `on` originally had. */
export type OnWire = string | OnWireTarget;

/**
 * Renders one sibling `UsesNode` once per element of a list-typed prop on
 * *this* component — the one iteration mechanism the composition surface
 * has. `over` names that prop (must resolve to `list<T>`); `as` is the
 * bound name each rendered instance's own `{expr}` props/`slotContent` may
 * reference (checked against `T`, the list's element type — see
 * `checkComposition`'s `bound` typecheck extension); `use` names the
 * sibling `UsesNode` instantiated once per element, the same way `uses`
 * names one instantiated exactly once; `key` (optional) names a field of
 * `T` — `T` must be a `record` for `key` to be set at all — used as
 * React's `key`/Angular's `trackBy`.
 *
 * `use`'s own node is claimed by this `each`, the same way a plain
 * `slotContent.*.uses` entry claims a node — it must not *also* appear in a
 * `uses` list, and (like every other composition node) must be reachable
 * from the tree's one root.
 *
 * Known gap, same one `DerivedNode` already documents: `as` follows the
 * same bare-identifier convention every bound name needs, but a hyphenated
 * `as` can be declared here yet never actually *referenced* from the
 * template node's `{expr}` values, for the same `loom-expr` lexer reason.
 * Give `as` a single word.
 */
export interface EachSlotContent {
  each: {
    over: string;
    as: string;
    use: string;
    key?: string;
  };
}

export interface UsesNode extends LoomNodeEnvelope {
  kind: "uses";
  /** This instance's own local name — referenced by other UsesNodes' slotContent.*.uses, or by an `each.use`. */
  name: string;
  /** Sibling spec slug to instantiate, resolved like `extends`. */
  component: SpecRef;
  /** The already-parsed, already-flattened tree `component` resolved to. Opaque to visit()/children(). */
  resolvedComponent: ComponentNode;
  /** Exactly one UsesNode per component must set this — the outermost embedded instance. */
  root?: boolean;
  /** Literal or live-computed prop values passed to the child instance. */
  props?: Record<string, PropValue>;
  /** Per-slot-name literal text, an ordered list of other UsesNode `name`s, this component's own declared FieldNode names to render natively, or an `each` iterating a list-typed prop. */
  slotContent?: Record<string, { text: string } | { uses: string[] } | { fields: string[] } | EachSlotContent>;
  /** Maps this embedded child instance's declared event name to one or more of this component's own declared events to fire. */
  on?: Record<string, OnWire | OnWire[]>;
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
