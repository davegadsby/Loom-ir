---
name: card
kind: primitive
category: layout
---

## Intent

A card groups related content into one visually-distinct surface —
the direct analog of Angular Material's `mat-card`, composed of a
header, a body, and an optional row of actions.

## Rationale

Three named slots (`header`, `content`, `actions`) and no Machine at
all — the first spec in either example set to combine "two or more
named slots" with "no interaction/state of its own." `disclosure.md` (in
the root example set) already proves multiple named slots, but always
alongside a machine; `list.md` proves a machine-less primitive, but with
only one (default) slot. Nothing in either emitter's slot-rendering path
treats slot count specially, so this combination costs nothing new to
support — this spec exists to make that claim concrete rather than
assumed.

Deliberately has no A11y section: unlike `button`/`checkbox`/`dialog`,
the WAI-ARIA APG defines no dedicated "card" pattern — a real `mat-card`
carries no default ARIA role either, leaving semantics to whatever a
consumer places inside it (a heading in `header`, real buttons in
`actions`). Omitting the section is itself the honest choice here, not
an oversight — `A11y` is optional in the parser (an empty array, not a
required section).

**Keyboard.** None — a card is a passive grouping container, not a
control; it declares no event of its own for anything to activate.
Whatever real interactive elements a consumer places inside `actions`
carry their own keyboard behavior independently of this component.

## Declarations

### header

```yaml
kind: slot
```

### content

```yaml
kind: slot
```

### actions

```yaml
kind: slot
```

## Claims

### reads-as-one-visually-distinct-surface

```yaml
kind: unexpressible
```

The header/content/actions grouping is meant to read as one cohesive,
visually-distinct surface (e.g. an elevated or outlined region), not
three unrelated blocks — a subjective, unmeasured claim, same treatment
as `list.md`'s `reads-as-a-list-not-a-generic-container`.

## Style

### root-background

```yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
```

The same design-token binding `checkbox.md` (in the root example set)
already proves — this is what actually makes the card read as a
"visually-distinct surface" (§ Claims above) rather than a bare `<div>`.

### root-layout

```yaml
kind: layout-intent
part: root
display: flex
direction: column
align: stretch
```

Stacks `header`/`content`/`actions` top-to-bottom rather than the row
layout every other Material spec so far uses — the first spec in either
example set to declare a `column` `layout-intent`, matching a real
`mat-card`'s own vertical stacking of its slotted regions. No
`gapToken` here (unlike every other Material spec's `root-layout`) —
`header-padding`/`content-padding`/`actions-padding` below give each
region its own spacing instead, so an outer gap would double up.

### root-radius

```yaml
kind: token-ref
part: root
property: border-radius
token: radius.md
```

Rounds the card's own corners — the first spec in either example set to
reference the `radius.*` token group.

### root-elevation

```yaml
kind: token-ref
part: root
property: box-shadow
token: elevation.raised
```

A real MD3 elevation-1 shadow stack, bound to a token the same way
`root-background`'s color is — `elevation.raised`'s own value is a
multi-value `box-shadow` string, not a single color/dimension, proving a
`token-ref`'s `token` can point at any `TokenLeaf`, not just the
color/dimension shapes every prior example happened to use (`TokenType`
already included `"string"` — see `packages/loom-tokens/src/types.ts`).
This, together with `root-radius`/`root-background`, is what actually
makes the card read as a raised, distinct surface (§ Claims) instead of
a flat rectangle.

### root-typography

```yaml
kind: token-ref
part: root
property: font-family
token: typography.fontFamily
```

Sets the card's base font once, at `root`, and lets it cascade to every
slotted child for free — a real, system-only sans stack (no webfont
fetch, since this environment has no outbound network access), replacing
the browser's default serif.

### header-layout

```yaml
kind: layout-intent
part: header
display: flex
direction: row
align: center
gapToken: spacing.sm
```

Lays whatever a consumer puts in `header` out as a row (an avatar next
to a title/subtitle stack, in `Card.stories.tsx`) rather than however it
would otherwise stack. The first Style node in either example set to
target a named slot rather than `root` — `TokenRefNode`/`LayoutIntentNode`'s
`part` field already supported this (see its own doc comment in
`packages/loom-ir/src/nodes.ts`), just never exercised until now.
**React-only**: `printRenderNodes` in `packages/loom-emit-react/src/emitReact.ts`
attaches a real class to a named slot's own wrapper `<div>` whenever a
Style node targets it, so this applies there for free. Angular's named
slots compile to `<ng-content select="...">`, projecting straight into
caller-supplied markup with no wrapper node of Angular's own to attach a
class to (`packages/loom-emit-angular/src/emitAngular.ts`'s own comment
on `styledParts` states this directly) — a real, pre-existing,
already-documented gap, not something this spec works around. The
practical result: this card's `header`/`content`/`actions` layout and
spacing render correctly in React and fall back to an unstyled stack in
Angular, on top of `root`'s own background/radius/elevation/font, which
both targets still get.

### header-padding

```yaml
kind: token-ref
part: header
property: padding
token: spacing.md
```

Breathing room around the header row.

### content-padding

```yaml
kind: token-ref
part: content
property: padding
token: spacing.md
```

Breathing room around the body copy — same token, same reasoning as
`header-padding`.

### content-typography

```yaml
kind: token-ref
part: content
property: font-size
token: typography.body.size
```

Body copy at the design's own body size rather than the browser default.

### actions-layout

```yaml
kind: layout-intent
part: actions
display: flex
direction: row
gapToken: spacing.sm
```

Lays the action buttons out as a row with the design's standard small
gap between them.

### actions-padding

```yaml
kind: token-ref
part: actions
property: padding
token: spacing.sm
```

Slightly tighter padding than `header`/`content` — a real `mat-card`'s
own action row sits a little closer to the card's edge.

### matches-reference

```yaml
kind: visual-conformance
reference: { kind: image, path: reference-images/card.jpeg }
```

A real Material card example, supplied directly rather than fetched (this
environment has no outbound access to material.angular.io) — an
avatar-plus-title/subtitle `header`, an image and body copy in `content`,
and two text actions in `actions`, the first real `image`-kind
`VisualReference` in either example set (see `AGENTS.md`'s Known Gaps).
The first real, non-inert use of `checkVisualReferencesExist`
(`packages/loom-validate/src/visualReferences.ts`) against committed
content, not just a test fixture. Kept as the originally-supplied JPEG
rather than re-encoded to PNG — no lossless conversion tooling is
available in this environment, and a lossy re-encode would be less
faithful to the source than the format mismatch it trades away. One real
consequence: `loom-visual-diff`'s `diffImages` (the manual
`pnpm visual:diff` pixel-diff tool) is PNG-only (`pngjs`), so this
particular reference can't be diffed against with that tool yet — a
documented boundary, not a silent gap.
