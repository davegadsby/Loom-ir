---
name: slide-toggle
kind: primitive
category: form
extends: [interactive-base]
---

## Intent

A slide toggle lets a user switch a single boolean choice on and off —
the direct analog of Angular Material's `mat-slide-toggle`.

## Rationale

Structurally identical to `checkbox.md` (in the root example set): a
two-state machine (`unchecked`/`checked`) rather than a plain boolean
prop, so the disabled/focusable contract inherited from
`interactive-base` and the click path can both be expressed as claims
about the machine — including matching state names to the `checked`
prop exactly, the same convention `machineSeedProp` (`loom-emit-core`)
relies on to seed the toggle's initial visual state from a consumer-set
`checked={true}`. Reuses
`pattern-conformance: checkbox` deliberately — the only way to get a
real native input tag today (§ A11y below) is that exact pattern name —
which is a real, honestly-documented visual/semantic approximation, not
a claim of true switch conformance: real Material renders a switch
(`role="switch"`), not a checkbox. See the `switch-semantics-delta` A11y
claim below.

**Keyboard.** Space toggles it — free from the browser, for the same
reason `checkbox.md` documents: the `checkbox` a11y pattern compiles to
a real `<input type="checkbox">`, and a native checkbox's Space
activation dispatches a real `click` event, driving the exact same
`turn-on`/`turn-off` transitions a mouse click would.

## Declarations

### checked

```yaml
kind: prop
type: bool
default: false
```

Whether the toggle is currently on.

### change

```yaml
kind: event
payloadType: "record{ checked: bool }"
```

Fired whenever `checked` changes as a result of user interaction.

## Machine

### unchecked

```yaml
kind: state
flags: { disabled: false, focusable: true }
```

### checked

```yaml
kind: state
flags: { disabled: false, focusable: true }
```

### turn-on

```yaml
kind: transition
from: unchecked
to: checked
trigger: { kind: event, name: click }
guard: "not disabled"
```

### turn-off

```yaml
kind: transition
from: checked
to: unchecked
trigger: { kind: event, name: click }
guard: "not disabled"
```

## Claims

### click-turns-on-an-off-toggle

```yaml
kind: scenario
from: unchecked
events:
  - { kind: event, name: click }
to: checked
```

A single click on an off, enabled toggle turns it on.

### click-turns-off-an-on-toggle

```yaml
kind: scenario
from: checked
events:
  - { kind: event, name: click }
to: unchecked
```

A single click on an on, enabled toggle turns it off.

### transitions-stay-within-declared-states

```yaml
kind: property
ident: t
domain: "transitions"
predicate: "t.to in states"
```

Every transition's destination is one of the component's own declared
states — the same proven claim shape `checkbox.md`/`disclosure.md`
already use.

## A11y

### checkbox-pattern

```yaml
kind: pattern-conformance
pattern: checkbox
```

Reused deliberately for the real native `<input type="checkbox">` tag
treatment it unlocks (§ Rationale) — no `switch` a11y pattern is
implemented by either emitter yet.

### switch-semantics-delta

```yaml
kind: delta
```

Real Material renders `mat-slide-toggle` with `role="switch"`, not
`role="checkbox"` — this component's underlying control is a checkbox in
ARIA terms even though it reads visually as a toggle switch. A documented,
deliberate divergence, not an oversight; adding real switch-pattern
native-tag treatment is separate, unscoped follow-up work (see
`docs/material-parity.md`).

## Style

### root-background

```yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
```

The same design-token binding `checkbox.md` (in the root example set)
already proves.

### root-layout

```yaml
kind: layout-intent
part: root
display: flex
direction: row
align: center
gapToken: spacing.sm
```

Lays the toggle control out as a row with the design's standard small
gap — the same minimal flex intent `checkbox.md` uses.
