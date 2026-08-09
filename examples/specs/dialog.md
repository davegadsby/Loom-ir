---
name: dialog
kind: primitive
category: overlay
---

## Intent

A dialog frames a title, a body, and a row of actions as an overlay —
purely presentational; it owns no interaction logic of its own.

## Rationale

Deliberately a dumb primitive with no machine: giving `dialog` its own
open/closed state driven by `open`/`close`-named events would collide
with a real, existing limitation — both component emitters hardcode a
single `dispatch("click")` call regardless of a transition's actual
trigger name, so named-event triggers like `open`/`close` would never
actually fire through generated code. Rather than papering over that
here, all open/close *behavior* lives one level up, on
`confirmation-dialog` — the component that actually composes this one —
which is also the more realistic "dumb building blocks, one smart
composite" shape for a real compound component.

## Declarations

### title

```yaml
kind: slot
```

### body

```yaml
kind: slot
```

### actions

```yaml
kind: slot
```

## Claims

### reads-as-a-modal-overlay

```yaml
kind: unexpressible
```

Visually reads as a modal overlay, not inline page content — a
subjective, unmeasured claim, same treatment as button's
`variants-read-as-visually-distinct`.

## A11y

### dialog-pattern

```yaml
kind: pattern-conformance
pattern: dialog
```

Conforms to the WAI-ARIA APG dialog pattern.
