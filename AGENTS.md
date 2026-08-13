# AGENTS.md

Instructions for coding agents (and anyone else) working in this repo.

## What this is

Loom IR is a deterministic spec-to-code compiler: markdown+YAML specs under
`examples/specs/` parse into a typed IR tree (`loom-ir`), then compile to
React and Angular components plus generated tests (`loom-emit-react`,
`loom-emit-angular`, `loom-emit-tests`), with a results ledger and coverage
reporting on top (`loom-results`, `loom-validate`). `docs/architecture.md`
is the design doc — read it before making structural changes to the IR,
schema, or emitters.

If a design change is in flight, check `/root/.claude/plans/` (or wherever
this session's plan file lives) before assuming the architecture described
below is final — it may be mid-refactor.

## Repo shape

Pnpm workspace, packages under `packages/*`. Each package builds via
TypeScript project references (`tsc -b`), extending the shared
`tsconfig.base.json`. **Build with `pnpm -r build` from the repo root**,
not `tsc` inside a single package — project references mean packages must
build in dependency order, and a single-package build will fail or use
stale `.d.ts` files from its dependencies.

## `examples/` is committed output, not a build artifact

`examples/generated/{react,angular,tests,styles,reports}/` is checked into
git. It exists to prove the compiler actually produces working code, and
to make the pipeline's output visible without anyone running the CLI.

**After changing anything in a parser, the IR, or either emitter**, run:

```
pnpm examples:generate
```

This regenerates `examples/generated/` from `examples/specs/`.
`packages/loom-cli/src/examplesUpToDate.test.ts` asserts the committed
files are byte-for-byte identical to a fresh compile — if you forget to
regenerate, that test fails in CI. If your change is expected to alter
output, review the diff in `examples/generated/` by hand before committing
it; it's part of the change, not incidental.

`pnpm typecheck:examples` type-checks the committed React/Angular output
against real `react`/`@angular/core` types (via `examples/tsconfig.json`,
which uses `moduleResolution: "Bundler"` since the emitted components use
extensionless relative imports). This is **not** part of `pnpm test` — run
it explicitly, and it also runs in CI.

`examples/tests/render.test.tsx` actually mounts the generated React
components and exercises them (click, type into fields, check computed
props). A few tests there are `it.fails` — these are **intentional
tripwires for known compiler defects**, not disabled tests. If one starts
passing unexpectedly, vitest will flag it as a failure; that's your signal
the underlying bug got fixed, not a test to delete. Don't "fix" one of
these by editing the test — either fix the actual defect (and let the
tripwire flip to a normal passing test) or leave it alone.

## Full verification sequence

Before considering a change done:

```
pnpm -r build
pnpm examples:generate && git diff --exit-code examples/generated   # empty unless output was meant to change
pnpm typecheck:examples
pnpm test          # or: npx vitest run
```

All four are checked in CI (`.github/workflows/ci.yml`).

## Conventions

- **Node IDs are structural, never derived from prose.** `component/section/slug`
  (see `packages/loom-ir/src/id.ts`). Rewording a spec's prose must never
  change a node's id — that's what keeps the results ledger from orphaning
  entries. If you add a new kind of IR node, decide deliberately whether it
  gets a real `LoomNodeEnvelope` (addressable, joinable, counted in
  coverage) or not — don't leave it ambiguous.
- **Determinism is load-bearing.** Same spec in → same tree, same emitted
  code, always. Several tests exist purely to enforce this
  (`examplesUpToDate.test.ts`, `loom-ir`'s own tree-shape tests). Don't
  introduce incidental nondeterminism (unordered `Map`/`Set` iteration where
  order matters, `Date.now()` in emitted output, etc.).
- **Emitters are hand-written string builders, not templates.** Both
  `loom-emit-react` and `loom-emit-angular` build output via `lines.push(...)`
  / string concatenation. When editing them, check the actual generated
  string against what's committed in `examples/generated/` — a plausible-looking
  change can produce subtly wrong whitespace or quoting that only shows up
  as a diff there.
- **Shared emitter logic lives in `loom-emit-core`**, not copy-pasted
  between the two backends. If you find yourself writing the same helper in
  both `emitReact.ts` and `emitAngular.ts`, it probably belongs there
  instead.
- Branch-per-feature, PR against `main`. Commit messages explain *why*, not
  just *what* — this repo's history is often the only record of a design
  decision (see any commit touching `packages/loom-ir/src/composition.ts`
  for the pattern).

## Known gaps (don't be surprised by these)

- Fixed: a machine-less component's own declared events used to never fire
  through generated code at all (only a machine-backed transition ever got
  a click handler). `EventNode.trigger` + `lowerRootHandlers`
  (`packages/loom-ir/src/lower.ts`) now wire a real handler for any
  declared event that names its own `trigger` — `{kind: "event", name:
  "..."}` (a named DOM event, e.g. `button.md`'s `press`/click) or
  `{kind: "key", key: "..."}` (a `keydown`, filtered to that one key, e.g.
  `dismiss-banner.md`'s `dismissed`/Escape — § Phase 5d). A `key` trigger
  also gets `tabIndex={0}`/`tabindex="0"` on the root, since a keydown
  handler is inert on an unfocusable element; actually moving focus there
  (autofocus-on-mount, a focus trap) is separate, out-of-scope work. A
  component may declare at most one *distinct* keyboard-trigger key across
  all its events (`checkComposition` throws otherwise) — both backends can
  only bind one `keydown` handler per root element. `{kind: "pointer"}`
  stays declarable but inert. Still not handled: (1) a *machine-driven*
  state change never fires a matching declared event on its own
  (`checkbox.md`'s own declared `change` event, e.g., is still never
  invoked — nothing links a `TransitionNode` to which event, if any, should
  fire when it's taken — not to be confused with the unrelated native DOM
  `change` event Checkbox's root now binds its dispatch handler to; only an
  event with its own explicit `trigger` does. (2) A
  *machine transition's* own `key`/`pointer` trigger is never wired to
  `dispatch` either — `LoomMachine`'s `Transition.matches` still hardcodes
  `trigger.kind === "event"` as a match requirement, so wiring one would
  emit a `dispatch` call that can never actually match.
- `loom-expr` is intentionally first-order (no user-defined functions, no
  `map`/`filter`, no way for a quantifier to range over a list-valued
  expression) — this is a deliberate design boundary, not an oversight. See
  `packages/loom-expr/src/domains.ts`'s header comment before trying to
  "fix" it.
- `loom-expr`'s identifier lexer has no hyphen in its grammar, so a
  kebab-case name — the convention every declared prop/field/`derived`
  value's `name` otherwise follows — can never be *referenced* from
  expression text (only declared): `parseExpr("submit-disabled")` parses as
  the binop `submit - disabled`, not a ref, and fails to typecheck as an
  unresolved reference. Not new to any one feature; it's just unexercised
  until something needs to reference a multi-word name from expression
  text. Give anything you intend to reference from an `{expr}`/`validate`/
  `guard`/etc. a single-word name for now. See `DerivedNode`'s doc comment
  in `packages/loom-ir/src/nodes.ts` for where this was first hit directly.
- A `PropertyNode` claim's domain *surface grammar* (`parseDomainClause` in
  `packages/loom-expr/src/parser.ts`) only recognizes `bool`/`int`/`float`/
  `string` as a base `type` domain — `record{...}`/`enum<...>`/`option<...>`
  cannot be written as (or nested inside `list<...>`/`where(...)`, etc.) a
  claim's domain, even though `Domain`'s `{kind:"type", type: LoomType}`
  variant and `domainToArbitrary` both already support an arbitrary
  `LoomType` generically. A property claim that needs to sample a
  record-shaped free input has to use a structurally-simpler stand-in
  domain instead (see `examples/specs/task-list.md`'s claim for a worked
  example, and why that's honest rather than a shortcut).
- `emitAngular` prints every `PropNode` unconditionally as `@Input() name:
  T = <defaultValue ?? null>;` — for a non-optional `T` (e.g. `string`,
  `record{...}`, an `enum`) with no declared `default`, that's `= null`,
  which fails Angular's TS compile under `strictNullChecks`. Every example
  spec before `list-item.md` happened to give every prop a default, so
  nothing exercised this until a prop was deliberately left required.
  Give a defaultless non-bool prop a `default` for now (`list-item.md`'s
  `label` does, with a comment explaining why) — fixing the emitter means
  first picking a real policy (definite-assignment `!`, a nullable type, a
  required-input diagnostic), not something one example spec should decide.
- A primitive component has no way to render one of its own prop's values
  as displayed content — only a *composed child's* `{expr}` prop can
  reference a value computed at render time; a primitive's own `lower()`
  path only ever produces `slot` render nodes from its own declared
  `SlotNode`s (`packages/loom-ir/src/lower.ts`). `list-item.md`'s `label`/
  `done` props are real, typed, and correctly threaded end to end (proven
  by unit tests evaluating the generated `{expr}` code directly), but
  never show up in `ListItem`'s own rendered DOM — there's currently no
  render-tree construct for "show my own prop here." A real gap, not
  specific to `each`/iteration; closing it needs a new `RenderNode`
  variant (something like `{ kind: "text"; value: Expr }` sourced from a
  component's own prop, not a literal), which is separate scope.
- `ResourceNode` (`kind: "resource"`, `packages/loom-ir/src/nodes.ts`) is
  runtime-identical to a plain `list<T>` prop — consumer-provided, no
  fetch/invoke mechanism, no loading/error state. What makes it "a
  resource" rather than a prop is only the declaration *kind*: the value
  graph sees it as `list<dataType>` (0 elements before load, 1 once
  loaded), so a `derived` value or a claim can address it by name and know
  it represents one loaded item, not an arbitrary collection. Actually
  performing async I/O — which `Effect` kind triggers a fetch, how the
  result lands back in this list, how loading/error state is represented
  — is real, separate scope this pass deliberately didn't take on; `invoke`
  (the `Effect` kind that would trigger one) has been declared but inert
  since `RenderNode` was introduced in Phase 1b. See `examples/specs/
  profile-card.md` for a worked example (a `profile` resource + a `loaded`
  derived value, proven via both a `property` claim and a `render.test.tsx`
  mount test).
- Fixed: `checkbox`'s a11y pattern gets a real `<input type="checkbox">`
  root (mirroring `button`'s real `<button>` tag, § Phase 5b), with
  `checked`/`disabled` bound as native properties instead of
  `data-state`/`aria-disabled`. Only the `checkbox` pattern gets this
  treatment — every other pattern keeps its `<div role="...">` shape,
  same scope limit Button's own tag change drew. Fixing it surfaced a
  real, previously-invisible bug shared by every machine-backed component:
  a machine's own `useState`/class-field `state` always seeded from
  `__machine.initialState` (the first-declared state), silently ignoring
  a prop like `checked`/`expanded` entirely — invisible before now because
  neither ever had a real, browser-rendered visual to be wrong about.
  `machineSeedProp` (`packages/loom-emit-core/src/machine.ts`) finds the
  one declared bool prop, if any, whose name exactly matches a declared
  state's own name — the only structural link this taxonomy has between
  "a prop that mirrors current state" and "which state that is" — and
  seeds from it when present; this generalizes for free to any
  machine-backed component shaped that way, not just `checkbox`
  (`disclosure`'s `expanded`/`collapsed`+`expanded` states get the same
  fix, a reviewed diff with no tag change). Angular needed `ngOnInit`, not
  a field initializer, since Angular sets `@Input()` values on the
  instance strictly after construction — a field initializer reading
  `this.checked` would only ever see the class's own declared default.
- Fixed: `FieldNode.validate`, a `derived` value's own `expr`, and a
  composed `{expr}` prop no longer emit `evaluate(exprJson, env)` calls —
  `compileExprToJs` (`packages/loom-emit-core/src/compileExpr.ts`)
  compiles each directly to native JS/TS referencing already-declared
  local variables/class members, resolved through an emitter-specific
  `RefResolver` (the replacement for building an env object literal). A
  component using only these three mechanisms no longer imports
  `loom-expr` at all; `checkbox`/`disclosure` still do, legitimately, for
  the unrelated `LoomMachine`/`Transition`/`Guard` runtime classes — "the
  interpreter" in this item's own name means `evaluate()` specifically,
  not the machine. The old `=== true`/`as T` coercion is gone too:
  compiled JS is already correctly typed, unlike an `any`-typed
  interpreter result. Scoped to exactly the `Expr` shapes real
  component-level exprs use — `literal`/`ref`/`member`/`unop`/`binop`/
  `ternary`/every `builtin`; `quant`/`statesRef`/`transitionsRef` throw,
  since they only make sense inside a claim's `states`/`transitions`
  domain, which no `FieldNode.validate`/`derived.expr`/computed prop has
  ever needed. Claims themselves are untouched — `loom-emit-tests` keeps
  evaluating claim predicates via the interpreter, since generated tests
  are dev-time-only and never shipped. One documented, narrower
  correctness boundary: `==`/`!=`/`in`/`contains`/`oneOf` compile to JS's
  own `===`/`.includes()`, correct for every primitive comparison (which
  is everything any current component-level expr does) but not for
  record/list-valued structural equality the way the interpreter's own
  `deepEquals` handles it — nothing has ever needed that at this level,
  and there's no type information available at this compile step to
  guard the case reliably, so it's flagged in `compileExprToJs`'s own doc
  comment rather than silently risked.
- Fixed: every declared event name is a kebab-case slug like any other
  declared name, but both emitters used to build callback-prop/`@Output`
  identifiers via `capitalize(name)` alone — valid only for a single-word
  name (`onPress`), and silently invalid JS (`onOption-selected`,
  `@Output() option-selected`) for a multi-word one. Never hit before
  `examples/material/specs/radio-group.md`'s `option-selected` event,
  since every prior example's event names happened to be one word.
  `camelCase(name)` (a no-op on an already-single-word name — confirmed
  zero-diff across every existing committed example) now runs before
  `capitalize` everywhere an event name becomes part of an identifier:
  `packages/loom-emit-react/src/emitReact.ts`'s props-interface/
  destructuring/`firesWhen`/`printEmitEffect`/`printHandlers` sites, and
  `packages/loom-emit-angular/src/emitAngular.ts`'s `@Output()` member,
  `printEmitEffect`, and `firesWhenLines`. `SelectionNode` +
  `each.selects` (the mechanism that gives N sibling `each`-templated
  instances one shared, mutually-exclusive selected value) shipped in the
  same pass — see `docs/material-parity.md` for the full design.
