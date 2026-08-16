# Loom IR

Loom IR is a deterministic spec-to-code compiler for UI components. A
markdown+YAML spec is parsed into a typed, framework-agnostic intermediate
representation (IR); backends then compile that same tree into React and
Angular components, generated tests (Jest, Storybook, axe), and a
human-facing briefing document.

It replaces "an AI agent reads a prose spec and regenerates code" with a
compiler pipeline. The same spec always produces the same tree and the same
output — determinism the prose-in/code-out approach can't give you, since
nothing structurally guarantees that what a spec claims is what an
LLM-authored implementation actually does.

AI still has a role, but it moves **upstream** — authoring and maintaining
spec files. Once a spec exists, compilation is deterministic and involves no
model inference.

See [`docs/architecture.md`](docs/architecture.md) for the full design
rationale (the node taxonomy, the expression language, why results never
live in the tree) and [`AGENTS.md`](AGENTS.md) for the conventions this repo
expects contributors (human or agent) to follow.

## Live examples

The compiled example components are published as a browsable Storybook on
GitHub Pages: **<https://davegadsby.github.io/Loom-ir/>**

## How it fits together

```
spec files (examples/specs/*.md)
        │  loom-parser
        ▼
   AST / IR (loom-ir)
        │
        ├──► loom-emit-react     ──► React components
        ├──► loom-emit-angular   ──► Angular components
        ├──► loom-emit-styles    ──► CSS (design tokens)
        ├──► loom-emit-tests     ──► Jest / fast-check / Storybook / axe
        └──► loom-emit-briefing  ──► human-facing doc
                     │
     results ledger (loom.results.json, CI output)
                     │
                     ▼
      loom-validate / loom-results → derived status + coverage report
```

A spec declares a component's public API, its state machine (if it has
one), behavioral **claims** about that machine, its accessibility contract,
and its design-token bindings — never anything framework-specific. Backends
walk the same tree and print different output; nothing about React or
Angular leaks into the IR itself.

Claims are the load-bearing idea: every behavioral assertion a spec makes
(`kind: scenario`, `kind: property`, `kind: invariant`, or an explicitly
prose-only `kind: unexpressible`) is a typed node the compiler can route to
a test emitter and later join against a real CI result — so "is this claim
actually verified" is a computed status, not something anyone hand-updates.

## Packages

Pnpm workspace, TypeScript project references, one package per pipeline
stage:

| Package | Role |
|---|---|
| `loom-schema` | Spec source grammar (JSON Schema) |
| `loom-expr` | The expression/claim-predicate language — parser, type checker, domains, sampling |
| `loom-parser` | Spec files → AST (including `extends` inheritance flattening and `uses` composition) |
| `loom-ir` | Node type definitions, visitor utilities, the state-machine runtime |
| `loom-emit-core` | Helpers shared by both component emitters (naming, the render-tree lowering pass, expression→JS compilation) |
| `loom-emit-react` | AST → React components |
| `loom-emit-angular` | AST → Angular components |
| `loom-emit-styles` | Design tokens + IR → CSS custom properties |
| `loom-emit-tests` | AST → Jest, fast-check property tests, Storybook play functions, axe checks |
| `loom-emit-briefing` | AST → human-facing documentation |
| `loom-tokens` | Tool-agnostic design-token format (W3C DTCG) + resolver |
| `loom-tokens-import-figma` | Converts a Figma Variables export into `loom-tokens`' format |
| `loom-results` | Results ledger format, joins ledger + IR, derives per-claim status |
| `loom-validate` | Coverage ratios, drift/staleness checks, CI gating |
| `loom-cli` | `loom` — the `author` / `compile` / `validate` / `report` / `tokens import` commands |

## Quickstart

Requires Node ≥20 and pnpm (pinned via `packageManager` — `corepack enable`
will pick up the right version automatically).

```bash
pnpm install
pnpm -r build          # builds every package in dependency order
pnpm test               # runs the full vitest suite
```

Build with `pnpm -r build` from the repo root, not `tsc` inside a single
package — the packages are wired together with TypeScript project
references, so they need to build in dependency order.

### Compile a spec

```bash
node packages/loom-cli/dist/bin.js compile examples/specs/checkbox.md --target react --out /tmp/loom-out
```

Emits component and test code for that one spec (run `pnpm --filter
loom-cli build` first if `dist/` doesn't exist yet). See `loom --help` (or
`packages/loom-cli/src/cli.ts`) for the full command set —
`author` scaffolds a new spec file, `validate` computes coverage ratios and
can gate on thresholds, `report` prints derived per-claim status joined
against a results ledger, and `tokens import` converts a design tool's
export into the tool-agnostic token format.

### Regenerate the committed examples

`examples/generated/` is committed output, not a build artifact — it exists
so the compiler's actual output is visible without anyone running the CLI
themselves. After changing anything in a parser, the IR, or either emitter:

```bash
pnpm examples:generate                 # regenerates examples/generated/ from examples/specs/
pnpm typecheck:examples                # typechecks the generated output against real react/@angular/core types
```

`packages/loom-cli/src/examplesUpToDate.test.ts` asserts the committed
files are byte-for-byte identical to a fresh compile, so a forgotten
regeneration fails loudly in CI rather than silently drifting.

### Storybook

The generated React components ship with real, browser-executed Storybook
interaction tests (`@storybook/test-runner` + Playwright):

```bash
pnpm storybook                # local dev server at localhost:6006
pnpm storybook:build          # static build → storybook-static/
pnpm storybook:test:ci        # build, serve, and run every play function in a real headless Chromium
```

Every push to `main` rebuilds and republishes this Storybook to GitHub
Pages via `.github/workflows/deploy-storybook.yml` — that's the site linked
above.

### Angular Storybook

The generated Angular components have their own Storybook config
(`.storybook-angular/`), run through `@storybook/angular`'s Angular CLI
Architect builders (`ng run loom-storybook:storybook` /
`storybook:build-storybook`, wrapped by the `storybook:angular` /
`storybook:angular:build` root scripts — a plain `storybook dev`/`build`
invocation isn't supported for this framework):

```bash
pnpm storybook:angular          # local dev server at localhost:6007
pnpm storybook:angular:build    # static build → storybook-static/
```

Stories import from `loom-angular-components` (`packages/loom-angular-components/`),
a real Angular library built once via `ng-packagr` (`pnpm build:angular-lib`,
wired as a prerequisite step in both scripts above) that re-exports the
generated components — the same pattern every real Angular component
library uses. This is what actually makes rendering work: an earlier
approach that had Storybook's own webpack build try to AOT/JIT-compile the
raw `.component.ts` source directly silently produced empty modules for
reasons never fully root-caused (see the comment at the top of
`.storybook-angular/main.ts` for that investigation); building through
`ng-packagr` instead sidesteps it entirely.

Every push to `main` also rebuilds and republishes this Storybook to GitHub
Pages, nested under `/angular/` in the same deploy as the React one (see
`.github/workflows/deploy-storybook.yml`), and the React Storybook composes
it via Storybook's `refs` feature (`.storybook/main.ts`) — open the linked
site above and look for the "Angular" section in the sidebar.

Components render structurally correct (real DOM, real `*ngFor`/selection
state, real Ivy view-encapsulation markers) but currently without their own
CSS applied — `preview.ts`'s global design-token import doesn't reach the
built page yet, a separate, smaller gap from the rendering fix above. Open
follow-up work; see `.storybook-angular/main.ts`'s doc comment.

## Writing a spec

A spec is a markdown file with YAML-fenced blocks per node, grouped under a
fixed set of section headings (Declarations, Machine, Claims, A11y, Style,
plus free-form prose in Intent/Rationale). `examples/specs/checkbox.md` is
a good short one to read end to end; the shape looks like:

````markdown
---
name: checkbox
kind: primitive
extends: [interactive-base]
---

## Declarations

### checked
```yaml
kind: prop
type: bool
default: false
```

## Machine

### unchecked
```yaml
kind: state
flags: { disabled: false, focusable: true }
```
...

## Claims

### click-checks-an-unchecked-box
```yaml
kind: scenario
from: unchecked
events:
  - { kind: event, name: click }
to: checked
```
````

Every other example spec under `examples/specs/` demonstrates a different
capability — composition (`confirmation-dialog.md`, `login-dialog.md`),
iteration (`task-list.md`), computed/derived values (`signup-dialog.md`),
async data (`profile-card.md`) — worth browsing before writing a new one.

## Contributing

Read [`AGENTS.md`](AGENTS.md) first — it covers the build order, the
"regenerate before committing" workflow, and conventions the codebase
relies on (structural node IDs, determinism, where shared emitter logic
belongs). Branch per feature, PR against `main`; CI
(`.github/workflows/ci.yml`) runs the build, both typecheck passes, the
full test suite, and the real-browser Storybook interaction tests.

## License

MIT — see [`package.json`](package.json).
