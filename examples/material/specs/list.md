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

**Keyboard.** None — `list` is a passive container, not a control; it
declares no event of its own for anything to activate. Whatever real
interactive elements a consumer places inside its `default` slot carry
their own keyboard behavior independently of this component.

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
direction: column
align: stretch
gapToken: spacing.sm
```

Stacks its `default`-slotted items top-to-bottom with the design's
standard small gap — a passive container's own layout, not an
interactive control's row (contrast `checkbox.md`/`radio-button.md`).
