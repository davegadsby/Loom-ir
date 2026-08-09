---
name: button
kind: primitive
category: form
extends: [interactive-base]
tokens: design-tokens.json
---

## Intent

A button is a press affordance — the smallest interactive primitive,
and the piece `confirmation-dialog` composes to build its Confirm action.

## Rationale

Content is carried by a `default` slot rather than a `label` prop,
matching native `<button>{children}</button>` — and, deliberately, so
that a composing component can demonstrate both literal-prop injection
(`variant`) and literal-slot-text injection (`default`) on the same
embedded instance.

## Declarations

### variant

```yaml
kind: prop
type: "enum<Variant: primary,secondary,danger>"
default: primary
```

Which visual treatment this button reads as.

### default

```yaml
kind: slot
```

### press

```yaml
kind: event
payloadType: "record{}"
```

Fired when the button is activated.

## Claims

### variants-read-as-visually-distinct

```yaml
kind: unexpressible
```

Each variant (primary/secondary/danger) is meant to read as visually
distinct to a sighted user — a subjective, unmeasured claim, same
treatment as checkbox's `touch-latency-feels-instant`.

## A11y

### button-pattern

```yaml
kind: pattern-conformance
pattern: button
```

Conforms to the WAI-ARIA APG button pattern.

## Style

### root-background

```yaml
kind: token-ref
part: root
property: background-color
token: color.surface.default
```

### root-layout

```yaml
kind: layout-intent
part: root
display: flex
align: center
gapToken: spacing.sm
```
