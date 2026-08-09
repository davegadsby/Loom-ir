---
name: checkbox
kind: primitive
category: form
extends: [interactive-base]
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
kind: path
from: unchecked
events:
  - { kind: event, name: click }
to: checked
```

A single click on an unchecked, enabled checkbox checks it.

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
