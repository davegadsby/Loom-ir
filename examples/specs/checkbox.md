---
name: checkbox
kind: primitive
category: form
extends: [interactive-base]
tokens: design-tokens.json
---

## Intent

A checkbox lets a user toggle a single boolean choice on and off.

## Rationale

Modeled as a two-state machine (`unchecked`/`checked`) rather than a plain
boolean prop, so that the disabled/focusable contract inherited from
`interactive-base` and the click path below can both be expressed as
claims about the machine, not as prose.

## Declarations

### checked

```yaml
kind: prop
type: bool
default: false
```

Whether the checkbox is currently checked.

### change

```yaml
kind: event
payloadType: "record{ checked: bool }"
```

Fired whenever the checked state changes as a result of user interaction.

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

### toggle-on

```yaml
kind: transition
from: unchecked
to: checked
trigger: { kind: event, name: click }
guard: "not disabled"
```

### toggle-off

```yaml
kind: transition
from: checked
to: unchecked
trigger: { kind: event, name: click }
guard: "not disabled"
```

## Claims

### click-checks-an-unchecked-box

```yaml
kind: scenario
from: unchecked
events:
  - { kind: event, name: click }
to: checked
```

A single click on an unchecked, enabled checkbox checks it.

### click-unchecks-a-checked-box

```yaml
kind: scenario
from: checked
events:
  - { kind: event, name: click }
to: unchecked
```

A single click on a checked, enabled checkbox unchecks it.

### transitions-stay-within-declared-states

```yaml
kind: property
ident: t
domain: "transitions"
predicate: "t.to in states"
```

Every transition's destination is one of the component's own declared
states — the highest-value kind of claim in the language (§6.5) because
it is only expressible at all because the IR contains the machine.

### touch-latency-feels-instant

```yaml
kind: unexpressible
```

Users report the toggle as feeling instantaneous on real hardware. This
is a subjective, unmeasured claim — no domain the sampler can build
values from captures "feels instant," so it stays prose and counts
against the expressibility ratio (§10) until perceptual latency has an
agreed-on metric.

## A11y

### checkbox-pattern

```yaml
kind: pattern-conformance
pattern: checkbox
```

Conforms to the WAI-ARIA APG checkbox pattern.

## Style

### root-background

```yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
```

The checkbox's own background surface, bound to a design token rather than
a literal value so every framework target stays in sync with the source
design file.

### root-layout

```yaml
kind: layout-intent
part: root
display: flex
direction: row
align: center
gapToken: spacing.sm
```

Lays the checkbox control out as a row with the design's standard small
gap — the minimal flex intent this taxonomy expresses, not a CSS
reimplementation.

### matches-figma

```yaml
kind: visual-conformance
reference: figma://frame/checkbox-default
```

The rendered checkbox is diffed against this Figma reference frame — the
`(visual)` / Chromatic row the architecture always reserved a place for
but never implemented until the Style taxonomy existed to name it.
