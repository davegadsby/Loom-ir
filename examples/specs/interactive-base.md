---
name: interactive-base
kind: primitive
category: base
---

## Intent

Shared contract for any interactive component: an interaction affordance
that can be disabled, plus the accessibility guarantee that a disabled
state is never independently focusable.

## Declarations

### disabled

```yaml
kind: prop
type: bool
default: false
```

Whether user interaction with the component is disabled.

## Claims

### disabled-not-focusable

```yaml
kind: property
ident: s
domain: "states"
predicate: "implies(s.disabled, not s.focusable)"
```

Any state that reports itself disabled must also report itself
unfocusable. This is checked against whichever concrete states the
extending component declares — `interactive-base` itself declares none.
