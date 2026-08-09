# Loom IR — Architecture

Status: design draft (v2 — includes node taxonomy and expression language)
Owner: Dave
Last updated: 2026-08-09

---

## 1. Purpose

Loom IR replaces "an AI agent reads a prose spec and generates code" with a
deterministic compiler pipeline: a spec is parsed into a typed, framework-agnostic
Abstract Syntax Tree (the Intermediate Representation), and per-framework backends
compile that IR into code and tests.

The problem being solved is **non-determinism and drift**. When an agent regenerates code
from prose, the same input can produce different output, and nothing structurally
guarantees that what the spec claims is what the implementation does. Loom IR makes the
spec a compiler input rather than a document open to interpretation.

AI still has a role — but it moves **upstream**, to authoring and maintaining spec files.
Once a spec exists, compilation is deterministic and involves no model inference.

---

## 2. Three-layer model

The architecture rests on a strict separation of three layers. Conflating any two of them
is the primary design failure mode.

| Layer | What it is | Properties |
|---|---|---|
| **1. Spec** | Authored intent — structured source | Human- and AI-authored; the editable surface |
| **2. AST / IR** | Deterministic compilation of intent into a typed tree | Pure function of the spec; same spec in → same tree out, always |
| **3. Results ledger** | Observed reality — test outcomes from CI | Runtime data; joined to the IR by node ID |

**Rule: results never live in the AST.** The moment observed outcomes are written back
into the tree, the tree stops being a pure function of the spec and determinism is lost.
Results live in a separate artifact (e.g. `loom.results.json`) and are joined to the tree
at report time.

---

## 3. Pipeline

```
Figma  ──►  spec files  ──►  parser  ──►  AST / IR  ──┬──►  emit-angular      ──►  component code
                                                       ├──►  emit-react        ──►  component code
                                                       ├──►  emit-webcomponent ──►  component code
                                                       ├──►  emit-tests-jest   ──►  unit + property tests
                                                       ├──►  emit-tests-sb     ──►  Storybook play functions
                                                       ├──►  emit-tests-axe    ──►  a11y checks
                                                       └──►  emit-briefing     ──►  human-facing doc
                                                                    │
                                       results ledger  ◄────────────┘  (CI output, keyed by node ID)
                                                │
                                                ▼
                                    derived status + coverage report
```

---

## 4. The AST is framework-agnostic

This is the central design commitment and the reason an IR exists at all.

The AST represents **what a component is and does** — its API surface, states and
transitions, accessibility contract, constraint logic, behavioural claims, and invariants.
It contains no framework concepts: no decorators, no hooks, no lifecycle methods, no
template syntax.

Framework-specific concerns live entirely in **backends** (emitters) that walk the same
tree and produce different output. This is the classic compiler pattern — one IR, many
targets.

Consequences:

- One spec can compile to Angular, React, and Web Components without duplication.
- Adding a framework means writing a backend, not touching specs or the IR.
- Anything that cannot be expressed without naming a framework does not belong in the IR.

---

## 5. Node taxonomy

### 5.1 Design method: work backwards from consumers

The taxonomy is derived from what backends need to consume, not from what sections a
document happens to have. If a node type has no backend that reads it, it does not exist.

| Backend | Needs |
|---|---|
| Component emitter | Public API, state machine, constraint logic, a11y contract |
| Test emitter | Assertable claims + routing metadata + a sampleable domain |
| Briefing emitter | Prose, rationale, Figma references |
| Validator / coverage | Node identity, assertability, provenance |

### 5.2 Collapses that fall out

A naive port of a ten-section document format yields ~10 node families. Several collapse:

- **Keyboard bindings are not a distinct type.** A key binding is a transition whose
  trigger is a key event in a context: `TransitionNode` with
  `trigger: { kind: 'key', key, context }`.
- **Decision tables are guards.** A constraint table is a set of guarded outcomes over an
  input tuple — `GuardNode` on transitions, or standalone `RuleNode` sharing the same
  predicate representation.
- **Behavioural scenarios are path assertions over the machine.** A scenario claims a
  *path*: given state S, on events E₁…Eₙ, reach T. Where the machine is authoritative
  (undrawn transitions not permitted), a scenario is not independent content — it is an
  assertion *about* the machine, and therefore **checkable at compile time**, before any
  test runs. A scenario traversing an undefined transition is a compile error.

### 5.3 The taxonomy

```
ComponentNode
├── Declarations   PropNode, EventNode, SlotNode, MethodNode
├── Machine        StateNode, TransitionNode (trigger, guard), GuardNode, RuleNode
├── Claims         InvariantNode, PropertyNode, PathNode, UnexpressibleNode
├── A11y           PatternConformanceNode, DeltaNode, AriaRelationNode
└── Prose          IntentNode, RationaleNode   (non-assertable)
```

Accessibility is mostly **reference, not content**: anchor to the APG pattern, then record
documented divergences as `DeltaNode`s. Do not re-encode APG in the IR.

### 5.4 Node envelope

Every node carries the same envelope:

```ts
type NodeId = string;   // structural path — component/section/index chain

interface LoomNode {
  id: NodeId;
  kind: NodeKind;
  origin: 'own' | { inheritedFrom: SpecRef; overridden: boolean };
  assertable: boolean;
  verify?: 'unit' | 'interaction' | 'a11y' | 'visual';
}
```

Carrying provenance **in the envelope** rather than in a separate inheritance structure
resolves the parse-time-vs-compile-time inheritance question in favour of **parse-time
flattening without loss of origin**: backends see one flat tree, while validators and IDE
tooling can still report "this invariant came from `overlay-base`."

### 5.5 Node identity

IDs are **structural, not textual** — derived from `component + section + node path`, never
from prose content. Rewording an intent or renaming a scenario must not orphan that node's
accumulated test results.

Node identity is the join key between the IR and the results ledger:

```
IR node  ──►  emitted test (tagged with originating node ID)
                    │
                    ▼
              CI result (keyed by that same node ID)
                    │
                    ▼
              joined onto the IR node at report time
```

---

## 6. Expression language

### 6.1 Three consumers, one language

Every construct must serve all three, and the third is the binding constraint:

| Consumer | Requirement |
|---|---|
| Validator / compiler | Statically evaluable where possible; type-checkable |
| Emitters | Renderable into Angular, React, Jest, Storybook idioms |
| Sampler | Domains must generate values (fast-check arbitraries) |

**If a domain cannot be sampled, the property cannot be tested and the node is worthless.**
This prunes the language hard, and that pruning is the point.

### 6.2 Foundational commitments

- **Total** — no unbounded loops, no recursion, no partial functions. Every expression
  terminates; the language is decidable and safe to evaluate at compile time.
- **Pure** — no side effects, no I/O, no clock. `now()` would destroy determinism.
- **First-order** — no user-defined functions; lambdas only in fixed higher-order positions
  (`all`, `any`, `count`).

This is not a limitation to apologise for. A Turing-complete predicate language cannot be
reliably rendered into four framework idioms; the restriction is what makes multi-target
emission possible at all.

### 6.3 Type system

```
Primitive   bool | int | float | string | enum<E>
Structured  list<T> | option<T> | record{ k: T, ... }
References  ref<StateId> | ref<PropId>
```

`option<T>` rather than universal nullability — nullability is precisely where component
specs go vague, and forcing it explicit is a feature. `ref<StateId>` lets predicates talk
about the machine (`state == Open`) in a form the compiler checks against real state nodes.

### 6.4 Grammar

```
expr    := literal | ref | unop expr | expr binop expr
         | expr '?' expr ':' expr
         | quant '(' ident 'in' domain ')' expr
         | builtin '(' args ')'

quant   := all | any | count
unop    := not | -
binop   := and | or | implies | == | != | < | <= | > | >= | + | - | in
builtin := len | isEmpty | contains | matches | distinct | sorted | oneOf
```

**`implies` is first-class deliberately.** Component constraints are overwhelmingly
conditional ("if disabled, then not focusable"). Writing `not A or B` obscures intent and
produces poor generated test names.

**`count` is load-bearing.** Selection constraints ("at most one selected", "at least one
option") are counting claims; expressing them through `all`/`any` is painful.

**Excluded: arithmetic beyond `+`/`-` on ints.** If a component spec needs multiplication,
business logic is leaking into a design system spec.

### 6.5 Domains

A `PropertyNode` is `∀ x ∈ D. P(x)`. `D` must be *constructive* — the sampler builds values
from it:

```
domain := type
        | 'oneOf' '[' literal, ... ']'
        | 'range' '(' lo ',' hi ')'
        | 'list' '<' domain '>' size
        | 'where' domain expr
        | 'states'
        | 'transitions'
```

**`where` requires a guard rail.** Filtered domains can reject nearly everything and starve
the sampler. The compiler must require satisfiability within N attempts and fail loudly
rather than hang CI.

**`states` and `transitions` are the highest-value constructs in the language.** They allow
claims quantified over the machine itself:

```
all (s in states)      implies(s.disabled, not s.focusable)
all (t in transitions) t.to in states
```

These catch real design-system bugs and are only expressible because the IR contains the
machine.

### 6.6 The escape hatch problem

There will be predicates the language cannot express. The temptation is a `raw:` escape
hatch containing framework code. **Reject it** — one `raw:` node and the spec is no longer
framework-agnostic, the property cannot be sampled, and the IR's central guarantee is gone.

Instead: `UnexpressibleNode` — a prose claim explicitly marked non-machine-verifiable,
which counts **against** coverage. The gap becomes visible and measured rather than
silently papered over, and the frequency of these nodes is the signal for what to add to
the language next.

### 6.7 Language build order

1. Type system + `oneOf` / `range` domains — enough for real properties
2. Core boolean and comparison operators, including `implies`
3. Jest + fast-check renderer — proves round-tripping before investing in more operators
4. `states` / `transitions` domains — highest-value addition
5. `where`, `count`, string builtins — as real specs demand them

Ship a language that is too small and grow it from observed `UnexpressibleNode` frequency.
The failure mode is designing an expressive language up front and discovering half of it
cannot be rendered into React.

---

## 7. Claim types

| Node | Shape | Verification |
|---|---|---|
| `InvariantNode` | Predicate, no free variables | One-shot unit test |
| `PropertyNode` | `∀ x ∈ D. P(x)` — requires machine-readable domain | Sampled via fast-check |
| `PathNode` | Start state, event sequence, expected end state | Compile-time check against machine; runtime play function |
| `UnexpressibleNode` | Prose claim, not machine-verifiable | None — counts against coverage |

The invariant/property distinction survives first principles intact and sharpens: the
**declared domain** is the load-bearing part of a property, and it must be machine-readable
rather than prose, because it is what the sampler consumes.

---

## 8. Tests are a backend

Tests are emitted from the same AST as the component code — not written separately, not a
different spec. Routing metadata on each node (`verify` in the envelope) selects the
backend.

| Node kind | Emitter | Output |
|---|---|---|
| `InvariantNode` | `emit-tests-jest` | One-shot unit test |
| `PropertyNode` | `emit-tests-jest` + fast-check | Sampled property test |
| `PathNode` | `emit-tests-sb` | Storybook play function |
| `PatternConformanceNode` / `DeltaNode` | `emit-tests-axe` | jest-axe check |
| (visual) | Chromatic | Visual regression |

Because code and tests come from a single tree, they cannot drift from each other by
construction — the failure mode where spec, implementation and tests each tell a different
story is eliminated structurally rather than by discipline.

---

## 9. Status is derived, not authored

Hand-maintained status always drifts: it records what someone last remembered to update,
not what is true. Under Loom IR status is **computed** by joining the results ledger onto
the AST:

| Condition | Derived status |
|---|---|
| Emitted test ran and passed | `confirmed` |
| Emitted test ran and failed | `known-gap` |
| Assertable, test emitted, never ran | `unverified` |
| Assertable, no test emitted | `unknown` (coverage hole) |
| `UnexpressibleNode` | `unverifiable` (counts against coverage) |

The validator's role changes accordingly: it stops checking whether a human updated a tag
and starts checking whether the tree is covered by results.

---

## 10. Spec coverage as a first-class metric

Because the AST knows every verifiable claim it contains, two ratios become computable that
are simply unavailable with prose specs:

- **Emission coverage** — assertable nodes with a corresponding emitted test.
- **Result coverage** — emitted tests with a recorded result.

Plus a third, unique to this design: **expressibility ratio** — the proportion of claims
that are machine-verifiable versus `UnexpressibleNode`. That number is both a quality
signal for the spec and a roadmap for the expression language.

This is a far stronger contract than "the validator parsed the file successfully." It
answers the real governance question: *how much of what we claim is actually verified?*
Thresholds can gate CI per component or per archetype.

---

## 11. Open design decisions

### 11.1 Non-assertable nodes — keep or strip?

**Recommendation: keep, marked non-assertable.** This lets the human-facing briefing be
generated from the same tree as code and tests, keeping all three in lockstep. Cost is a
larger tree containing nodes no code backend compiles. Decide deliberately — it determines
whether the briefing is a compiler output or a separately maintained document.

### 11.2 Inheritance resolution

**Resolved (§5.4):** flatten at parse time, retain origin in the node envelope. Simple
backends, preserved provenance.

### 11.3 CEM's role

If the IR generates the component, the IR *is* the source of truth and the custom elements
manifest becomes an **output artifact** rather than an input to cross-check against. This
inverts current causality and changes whether a CEM-seeded draft command remains meaningful
or becomes migration-only tooling.

### 11.4 Machine authority vs. scenario independence

Compile-time path checking (§5.2) depends on the state machine being authoritative and
complete. If any component needs behaviour outside the machine, either the machine model
must expand or `PathNode` loses its compile-time guarantee. Worth confirming against the
hardest composite component before committing.

---

## 12. Package shape (TypeScript monorepo)

```
packages/
  loom-schema/         Spec source grammar + JSON Schema
  loom-expr/           Expression language: parser, type checker, domain definitions
  loom-parser/         spec files ──► AST (incl. inheritance flattening)
  loom-ir/             Node type definitions; visitor utilities
  loom-emit-angular/   AST ──► Angular components
  loom-emit-react/     AST ──► React components
  loom-emit-tests/     AST ──► Jest / fast-check / Storybook / axe
  loom-emit-briefing/  AST ──► human-facing document
  loom-results/        Results ledger format; join + derived status
  loom-validate/       Coverage, drift detection, CI gating
  loom-cli/            author, compile, validate, report
```

`loom-expr` is deliberately its own package: it is the hardest and most reusable piece, and
isolating it keeps the parser from accreting predicate logic.

The split matters commercially as well as technically — `loom-schema`, `loom-expr`,
`loom-parser`, `loom-ir` and one emitter form a coherent open-source core, while
multi-framework emitters, results/coverage reporting and CI gating are the natural paid or
hosted layer.

---

## 13. Design principles

1. **The IR is a pure function of the spec.** No observed data, no environment, no
   timestamps in the tree.
2. **Framework knowledge lives only in backends.** If a concept cannot be named without
   naming a framework, it is not IR.
3. **Node identity is structural, not textual.** Rewording must not orphan history.
4. **Code and tests come from the same tree.** Drift between them becomes impossible rather
   than merely discouraged.
5. **Status is computed, never authored.** Anything hand-maintained will be wrong.
6. **If it cannot be sampled, it cannot be a property.** The sampler is the arbiter of what
   the language admits.
7. **No escape hatches.** Unexpressible claims are recorded and measured, never smuggled in
   as raw framework code.
8. **Ship the language too small.** Grow it from observed gaps, not anticipated ones.

---

## 14. Build order

1. `loom-expr` — types, core operators, `oneOf`/`range` domains, type checker
2. `loom-ir` — node definitions and envelope
3. `loom-parser` — one archetype end to end (a primitive, e.g. a checkbox)
4. `loom-emit-tests` — Jest + fast-check only; proves the language round-trips
5. First component emitter — one framework only
6. `loom-results` + `loom-validate` — close the loop, derive status, report coverage
7. Second framework emitter — this is the test of whether the IR is genuinely
   framework-agnostic; if it hurts, the abstraction is wrong

Step 7 is the real validation of the whole architecture. Do not defer it far — a
single-target IR that has never been retargeted is an untested hypothesis.

---

## 15. Note on provenance

This architecture is developed as a general, framework-agnostic approach to spec-driven
component generation. Any implementation intended for use outside an employer context
should be built independently — node types, schema, expression language and CLI designed
from first principles rather than derived from an existing proprietary implementation.
