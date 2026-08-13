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
gapToken: spacing.sm
```

Stacks `header`/`content`/`actions` top-to-bottom rather than the row
layout every other Material spec so far uses — the first spec in either
example set to declare a `column` `layout-intent`, matching a real
`mat-card`'s own vertical stacking of its slotted regions.
