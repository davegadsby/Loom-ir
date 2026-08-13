---
name: radio-button
kind: primitive
category: form
extends: [interactive-base]
---

## Intent

A radio button represents one option within a mutually-exclusive set —
never meaningful alone; always rendered as one of several siblings a
`radio-group` composes and keeps in sync.

## Rationale

Deliberately has no Machine of its own and no opinion about its
siblings: `checked` is a plain, parent-controlled bool prop, the same
"dumb primitive" shape `button.md` (in the root example set) takes — the
actual mutual-exclusivity logic (only one sibling ever reads
`checked: true` at a time) lives entirely in whichever composite embeds
it (`radio-group.md`), via a shared `selection` declaration and
`each.selects` wiring. `label` renders as this component's own text
content (`content: true` on the prop below) — the same, now-closed gap
`list-item.md`'s `label` also uses; previously a primitive had no way to
render one of its own props as displayed content at all.

**Keyboard.** Click-only. Real WAI-ARIA APG Radio Group keyboard
behavior — arrow-key movement between siblings via roving `tabindex`,
plus Space/Enter activation — is deliberately **not** implemented this
pass: `radio-button`'s a11y pattern falls into the generic
`<div role="...">` path (no native `<input type="radio">` treatment
exists yet, unlike `button`/`checkbox`), so nothing here gets keyboard
activation for free from the browser either. A real, separate,
documented gap — not silently skipped.

## Declarations

### value

```yaml
kind: prop
type: string
default: ""
```

This option's own identifying value — compared against a `radio-group`'s
shared `selected` state to decide whether this instance reads as
checked.

### label

```yaml
kind: prop
type: string
default: ""
content: true
```

This option's own display text, rendered as this component's own text
content (§ Rationale).

### checked

```yaml
kind: prop
type: bool
default: false
```

Whether this option currently reads as selected — entirely
parent-controlled; this component never sets it itself.

### press

```yaml
kind: event
payloadType: "record{}"
trigger: { kind: event, name: click }
```

Fired when this option is activated. `radio-group.md`'s own
`each.selects` wiring is what actually turns a `press` into "this option
becomes the shared selected value" — from this component's own point of
view, `press` is just a plain, `button.md`-shaped click event.

## Claims

### checked-reads-as-visually-distinct

```yaml
kind: unexpressible
```

A checked radio button is meant to read as visually distinct from an
unchecked one — a subjective, unmeasured claim, same treatment as
`checkbox`'s `touch-latency-feels-instant`.

## A11y

### radio-pattern

```yaml
kind: pattern-conformance
pattern: radio
```

Conforms to the WAI-ARIA APG radio pattern's per-item shape — the
group-level roving-tabindex/keyboard-navigation behavior is
`radio-group.md`'s (undelivered, see Rationale) concern, not this
primitive's.

## Style

### root-background

```yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
```

The same design-token binding `checkbox.md` (in the root example set)
already proves — every framework target stays in sync with the source
design file instead of hardcoding a literal color.

### root-layout

```yaml
kind: layout-intent
part: root
display: flex
direction: row
align: center
gapToken: spacing.sm
```

Lays the radio button out as a row (the checked indicator and its label,
once a real indicator element exists) with the design's standard small
gap — the same minimal flex intent `checkbox.md` uses.
