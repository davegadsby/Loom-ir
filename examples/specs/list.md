---
name: list
kind: primitive
category: layout
---

## Intent

A bare list container — one `default` slot, nothing else. Exists purely
so `task-list` has something presentational to iterate into; the
iteration mechanism itself (`each`) belongs to the composing component,
not to this primitive.

## Declarations

### default

```yaml
kind: slot
```

## Claims

### reads-as-a-list-not-a-generic-container

```yaml
kind: unexpressible
```

Visually and semantically reads as a list of items, not an arbitrary
`<div>` — a subjective, unmeasured claim, same treatment as `dialog`'s
`reads-as-a-modal-overlay`.

## A11y

### list-pattern

```yaml
kind: pattern-conformance
pattern: list
```

Conforms to the WAI-ARIA APG list pattern.
