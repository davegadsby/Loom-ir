---
name: list-item
kind: primitive
category: layout
---

## Intent

One row of a `list` — a label and a done flag, nothing else. The
smallest interactive-free leaf `task-list` instantiates once per element
of its `tasks` prop, via `each`.

## Declarations

### label

```yaml
kind: prop
type: string
default: ""
```

The item's own display text. Given a default rather than left required —
a real, newly-discovered gap, not stylistic preference: `emitAngular`
prints every `PropNode` as `@Input() name: T = <default ?? null>;`
unconditionally, and `null` isn't assignable to a non-optional `T` like
`string` under `strictNullChecks` — every prior example spec happens to
give every prop a default already, so nothing exercised this before.
Tracked as a known gap (`AGENTS.md`), not fixed here — fixing it means
picking a real policy (definite-assignment `!`, a nullable type, a
required-input diagnostic) `list-item` alone shouldn't decide.

### done

```yaml
kind: prop
type: bool
default: false
```

Whether this item is marked complete.

## Claims

### done-reads-as-visually-distinct

```yaml
kind: unexpressible
```

A done item is meant to read as visually distinct (e.g. struck through)
from a not-done one — a subjective, unmeasured claim, same treatment as
button's `variants-read-as-visually-distinct`.

## A11y

### listitem-pattern

```yaml
kind: pattern-conformance
pattern: listitem
```

Conforms to the WAI-ARIA APG listitem pattern.
