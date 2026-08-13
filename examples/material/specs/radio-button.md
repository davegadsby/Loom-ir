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
`each.selects` wiring. `label` is a real, typed prop threaded end to end
but never rendered into this component's own DOM — the same documented
gap `list-item.md`'s `label` already carries (no `RenderNode` construct
yet exists for "show my own prop here"); a consumer/composite is
expected to render it itself (see `radio-group.md`'s own `label` usage).

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
```

This option's own display text. See Rationale — never rendered by this
component itself.

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
