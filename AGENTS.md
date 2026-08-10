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

- Generated components that have no state machine never wire up a click
  handler at all — a machine-less component's own events currently cannot
  fire through generated code. Tracked, not yet fixed.
- Keyboard/pointer triggers are parsed but never wired to real DOM events;
  only a generic `click` dispatches.
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
