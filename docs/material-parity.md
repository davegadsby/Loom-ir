# Material Design Component Parity — a stress-test roadmap

Status: draft
Last updated: 2026-08-13

## 1. Purpose

This doc is an empirical stress test of Loom IR's expressiveness, run
against a real, external component catalog (Angular Material) rather than
specs designed to fit the compiler. It mirrors [`architecture.md`](architecture.md)
§10's framing — "the expressibility ratio is... a roadmap for the
expression language" — applied one layer down, to the render/composition
surface rather than the claim language: every Material component that
turns out to be unreachable names a real, specific gap, not a vague
"more work needed."

**Scope boundary, stated up front and binding on everything below**: this
doc, and the `examples/material/` spec set it documents, are the *only*
places "Material" appears anywhere in this repository. No package under
`packages/` names, imports, or reasons about Angular Material or any other
specific design system — `SelectionNode`/`each.selects` (§5, the one new
mechanism this pass adds) are generic IR mechanisms any spec author can
use for any component library. Loom IR stays vendor-agnostic; this doc is
a roadmap for authoring specs *against* it, not a plan to couple the
compiler to one design system.

## 2. Buckets

- **A — buildable today**, with zero changes to any `packages/*` code.
  Purely a matter of writing the spec.
- **B — needs one small, well-scoped mechanism.** Reachable without a
  large new subsystem; §5 designs and implements exactly one (shared
  selection across `each` siblings).
- **C — needs a large, genuinely separate subsystem** (overlay
  positioning, timers, imperative method compilation, recursive
  composition). Out of scope for any near-term pass; sketched in §6 so
  future work has a starting point instead of a blank page.

## 3. Inventory

| Component | Bucket | Reachable via | Notes |
|---|---|---|---|
| mat-button | A | `examples/specs/button.md` (root set), 1:1 | Isomorphic already — renamed variant enum only |
| mat-checkbox | A | `examples/specs/checkbox.md` (root set) | The taxonomy's own original worked example |
| mat-slide-toggle | A | `examples/material/specs/slide-toggle.md` | Reuses the `checkbox` a11y pattern for its real `<input>` tag; documented `DeltaNode` for the switch-vs-checkbox ARIA divergence |
| mat-card | A | `examples/material/specs/card.md` | First spec combining ≥2 named slots with no Machine at all |
| mat-list / mat-nav-list | A | `examples/specs/{list,list-item,task-list}.md` (root set) | Fully proven via `each` |
| mat-radio-button / mat-radio-group | B (**this pass**) | `examples/material/specs/{radio-button,radio-group}.md` | `SelectionNode` + `each.selects` — see §5. Click-only; no roving-tabindex arrow-key navigation |
| mat-progress-bar / mat-slider | B | — (not built) | Needs a generic prop→`aria-value*` attribute binding — a third hardcoded case after `disabled`/`checked` (§6.2) |
| mat-tabs | B (partial) | — (not built) | Could reuse `SelectionNode` for "which tab is active" the same way `radio-group` uses it for "which option is selected" — but still needs a tabpanel `aria-relation` and roving-tabindex keyboard nav on top, neither built |
| mat-expansion-panel (single-open accordion) | B (partial) | — (not built) | Same boundary as tabs: `SelectionNode` covers "which panel is open," an aria-relation/animation layer doesn't exist |
| mat-menu | C | — | Overlay/positioning (§6.1) |
| mat-select | C | — | Overlay/positioning, likely `SelectionNode` too for the chosen option |
| mat-autocomplete | C | — | Overlay/positioning + filtering |
| mat-tooltip | C | — | Overlay/positioning + pointer/hover trigger wiring (§6.2 — distinct from the progress-bar gap despite the shared section number) |
| mat-datepicker | C | — | Overlay/positioning (a popup calendar grid) |
| mat-snackbar | C | — | Overlay/positioning + timers/transient auto-dismiss (§6.3) |
| mat-bottom-sheet | C | — | Overlay/positioning |
| mat-tree | C | — | Recursive/self-referential composition (§6.5) — unproven either way, never exercised past 2 levels |
| mat-table | C | — | A richer `each` (columns × rows) + record-domain claims (§6.6) |
| mat-stepper | C | — | A machine (buildable today) + `MethodNode` compilation for imperative `next()`/`previous()` (§6.4) |

## 4. What's genuinely new here vs. what already existed

Two corrections surfaced while building §5, both confirmed by direct
source reads before writing any code — worth recording since they
contradicted the initial assumption that existing machinery would "just
generalize":

1. **`set-cell` (`packages/loom-ir/src/render.ts`) was declared in the
   `Effect` union since the render tree was introduced, but had zero
   producers or consumers anywhere.** `FieldNode`'s own `<input>`
   `onChange` is hand-rolled per emitter, bypassing the `Handler`/`Effect`
   mechanism entirely. §5 writes its first real producer and consumer,
   not a generalization of anything already wired.
2. **There was no generic "declared prop → matching `aria-*` attribute"
   mechanism** — only `disabled → aria-disabled` was hardcoded. §5 adds a
   second hardcoded case (`checked → aria-checked`), not a general
   mechanism; a `progress-bar` spec needing `value → aria-valuenow` would
   need a *third* one, which is why it's Bucket B, not A (§6.2).
3. **A primitive had no way to render one of its own props as its own
   visible text content** — only a *composed child's* `{expr}` prop could
   reference a value computed at render time; a primitive's own `lower()`
   path only ever produced `slot` render nodes. This is why the first
   `radio-button` pass rendered with no visible label at all. Fixed by a
   small follow-up (`PropNode.content?: boolean`, see `AGENTS.md`'s Known
   Gaps): `radio-button.md`'s and (in the root example set) `list-item.md`'s
   own `label` props now render as real text. All five Material specs also
   gained real `## Style` sections in the same pass (reusing `checkbox.md`'s
   own `color.surface.default`/`spacing.sm` token paths), and
   `.storybook/preview.ts` now actually imports `tokens.css` globally — the
   combination of these three fixes is what makes every Material story
   visually inspectable at all, not just structurally correct.

## 5. What this pass proves: `SelectionNode` + `each.selects`

The one new mechanism, built and proven against `radio-group` (a real,
browser-tested, non-vacuous example — see
`examples/material/stories/RadioGroup.stories.tsx`): a `SelectionNode`
declaration is local, parent-owned mutable state (not a prop, not a
`FieldNode`, not a `derived` value) that N sibling `each`-templated
instances can share. `each.selects` wires one instance's own declared
event to overwrite that shared cell with a field of the currently-bound
item; because every sibling's own "am I selected" comparison reads the
*same* cell, clicking any one instance both selects it and deselects
every other — for free, with no per-instance synchronization code.

This is deliberately the smallest mechanism that closes a real gap:
it says nothing about keyboard navigation, ARIA relations between the
group and its members, or animated transitions — those are real,
separate, undone pieces (tracked in §3's "B, partial" rows for tabs and
accordions, which would reuse this exact mechanism for their own "which
one is active" state once built). What it *does* unlock for free, the
moment someone builds it: any future single-selection-among-siblings
pattern — tabs, a single-open accordion, a segmented control — starts
from a proven primitive instead of a blank page.

## 6. Design sketches — gaps not closed this pass

One paragraph each, at the rigor level §5 was designed at, for every
Bucket C item's underlying gap. None of these are new discoveries — each
already appears in `AGENTS.md`'s Known Gaps section or was confirmed
absent by a direct grep across `packages/`; this section just organizes
them against the concrete components that need them.

### 6.1 Overlay/positioning subsystem

Nothing in `loom-ir`, `loom-emit-react`, or `loom-emit-angular` has any
concept of portal rendering, anchor positioning, or z-index layering —
confirmed absent by grep (`portal`, `overlay`, `anchor`, `z-index` all
return zero structural hits). Every current component renders in normal
document flow. A menu, select panel, autocomplete listbox, datepicker
popup, tooltip, and snackbar all need to render outside their triggering
element's DOM position, typically anchored to it. This would need a new
`RenderNode` kind (something like `{kind: "portal"; anchor: ...; placement:
...}`) and a real per-framework portal mechanism (`ReactDOM.createPortal`,
Angular's CDK overlay or a hand-rolled equivalent) — a genuinely large,
separate piece of work, not a small extension of anything that exists.

### 6.2 Pointer/hover trigger wiring

`Trigger.kind: "pointer"` (`packages/loom-ir/src/nodes.ts`) has existed in
the type since triggers were introduced, and is accepted by the schema and
parser — but `lowerRootHandlers` only ever wires `"event"` and `"key"`
triggers into real handlers; `"pointer"` produces no `Handler` at all,
permanently. A tooltip's show-on-hover behavior needs this wired to real
`pointerenter`/`pointerleave` (or `mouseenter`/`mouseleave`) DOM events,
following the same pattern `"key"` triggers already established (§ Phase
5d) — a genuinely small, well-understood addition, gated here only because
it's paired with the overlay work above to be useful for any real Material
component. The generic prop→`aria-*` attribute binding gap (§4.2, needed
for `progress-bar`'s `aria-valuenow`) is unrelated but similarly small —
both are real, scoped, single-mechanism additions, just not attempted this
pass.

### 6.3 Timers / transient auto-dismiss state

No component anywhere schedules a delayed effect — confirmed by grep for
`setTimeout`/`setInterval` across every emitter. A snackbar's auto-dismiss
needs one: fire an effect N milliseconds after mount, cancelable if the
user interacts first. `docs/architecture.md` §6.2 states expressions are
deliberately pure and timeless ("`now()` would destroy determinism") — that
principle applies to the *claim* language, not necessarily to the render
tree's `Effect` union, which already models genuine side effects
(`dispatch`, `emit`, `set-cell`). A `{kind: "after-delay"; ms: number;
effects: Effect[]}` `Effect` variant, structural rather than
expression-based (mirroring how `firesWhen` is already a structural,
non-expr mechanism), is the likely shape — not designed further here since
no component needs it yet.

### 6.4 `MethodNode` compilation

`MethodNode` has been parseable since the very first taxonomy design and
is exercised by real specs (`disclosure.md`'s `focus-trigger`) — but
neither emitter has ever compiled one; both just log a warning and skip
it (§14 step 5's "skip, don't throw" contract). A real imperative handle
needs a framework-specific mechanism (`useImperativeHandle` + `forwardRef`
in React; a `ViewChild`-exposed public method in Angular) that hasn't been
designed. `mat-stepper`'s `next()`/`previous()` and many overlay
components' `open()`/`close()` all need this — it's one of the more
broadly useful Bucket C gaps, since almost every "C" component above
touches it in some form (an overlay needs an imperative dismiss path even
once positioning itself is solved).

### 6.5 Recursive / self-referential composition

`checkComposition`'s tree-shape check (DFS from one root `UsesNode`) has
no rule against a component embedding itself, directly or transitively —
but nothing has ever exercised it either. Every example spec's
composition tree is exactly two levels (a composite embedding primitives).
A `mat-tree` needs a tree node to embed further instances of its own
component. Whether the existing mechanism already handles this correctly
or needs real changes (cycle detection already exists for `extends`/`uses`
resolution at the file-resolver level — `makeFileResolveBase`'s
`inProgress` guard — but that guards *spec loading*, not a legitimately
recursive *render* structure) is genuinely unknown until someone tries it.

### 6.6 Record-domain claims

`PropertyNode.domain`'s surface grammar (`parseDomainClause` in
`packages/loom-expr/src/parser.ts`) only accepts `bool`/`int`/`float`/
`string` as a base `type` domain — never `record{...}`, `enum<...>`, or
`list<record{...}>`, even though the underlying `Domain`/
`domainToArbitrary` machinery already samples an arbitrary `LoomType`
generically. Every example that's hit this (`task-list.md`, `profile-card.md`,
and this pass's own considerations for `radio-group`) worked around it
with a structurally-simpler, length-preserving stand-in domain (`list<int>`
in place of `list<record{...}>`) rather than leaving the claim unwritten —
an honest substitution, not a shortcut, but a real surface-grammar gap
nonetheless. `mat-table`'s column/row claims would need this closed for
real, non-approximated coverage.

## 7. Suggested next steps

Not a commitment, just an ordering that follows from what's already
proven: pointer trigger wiring (§6.2) is the smallest remaining gap and
would unlock `mat-tooltip` once paired with even a minimal overlay
mechanism; `MethodNode` compilation (§6.4) is the most broadly reusable,
since it's a prerequisite piece of nearly every Bucket C component above,
not just one. The overlay/positioning subsystem itself (§6.1) is the
biggest single unlock — menu, select, autocomplete, datepicker, snackbar,
and bottom-sheet are all blocked on it — and the natural next stress-test
target once it exists.
