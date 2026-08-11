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

**Keyboard.** Enter and Space both activate it — free from the browser,
since the `button` a11y pattern (§ A11y below) compiles to a real
`<button>`, not a `<div role="button">`. No declared `kind: "key"` trigger
is needed or possible here: `press`'s own `trigger` (below) is
`kind: "event"`, and the browser itself synthesizes a `click` event for
both keys on a real `<button>` before this component ever sees it.

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
trigger: { kind: event, name: click }
```

Fired when the button is activated. `trigger` is what actually wires a
click handler on Button's own root — without it (as it shipped through
Phase 4), Button declared `press` but never fired it, since only a
machine-backed transition ever got a click handler; Button has no
machine at all. This is the fix for the root cause behind all three
`it.fails` tripwires `examples/tests/render.test.tsx` has carried since
Phase 0 — `ConfirmationDialog`'s `onClosed` and `LoginDialog`'s `onLogin`
both only ever depended on their own composed Button correctly firing
its own `press` first.

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
