---
name: radio-group
kind: composite
category: form
---

## Intent

A set of mutually-exclusive `radio-button` options, rendered from a
runtime-provided list and kept in sync by one shared selected value —
the direct analog of Angular Material's `mat-radio-group` +
`mat-radio-button` pair, and the first real spec to prove Loom's
shared-selection mechanism (`SelectionNode` + `each.selects`).

## Rationale

Reuses the `list`/`each` composition shape `task-list.md` (in the root
example set) already proved — a root `list`-component instance whose
`default` slot is an `each` over `options`, templating one `radio-button`
instance per element — extended with exactly one new piece: `selects`,
wiring the template's own `press` event to also overwrite this
component's shared `selected` declaration with the clicked option's own
`value`. Because every rendered `radio-button`'s own `checked` prop is
the *same* comparison (`selected == option.value`) against that *one*
shared cell, clicking any one option's own click handler both selects it
and deselects every other option, for free — no per-instance state to
synchronize, no coordination code beyond the one `set-cell` effect
`each.selects` produces.

`selected`'s own `initialValue` is fixed at compile time (the same
compile-time-only convention `FieldNode.initialValue` already has, e.g.
on `login-dialog`'s fields) — there is currently no mechanism for a
consumer to override a `SelectionNode`'s starting value the way a
`PropNode` can be bound; a real Material-parity radio-group would likely
want `[value]`-style controllability, which is out of scope for this
first pass (see `docs/material-parity.md`).

**Keyboard.** Same click-only boundary `radio-button.md` documents — no
roving-tabindex arrow-key navigation between options this pass.

## Declarations

### options

```yaml
kind: prop
type: "list<record{value: string, label: string}>"
default: []
```

The set of selectable options, in display order.

### selected

```yaml
kind: selection
type: string
initialValue: compact
```

The currently-selected option's own `value` — shared by every rendered
`radio-button`, and the one piece of state `each.selects` (below) keeps
in sync on click.

### option-selected

```yaml
kind: event
payloadType: "record{value: string, label: string}"
```

Fired with the newly-selected option's own `value`/`label` whenever a
different option is clicked.

## Composition

### list-instance

```yaml
kind: uses
component: list
root: true
slotContent:
  default:
    each:
      over: options
      as: option
      use: radio-button-template
      key: value
      selects: { on: press, selection: selected, field: value }
```

### radio-button-template

```yaml
kind: uses
component: radio-button
props:
  value:
    expr: "option.value"
  label:
    expr: "option.label"
  checked:
    expr: "selected == option.value"
on:
  press:
    event: option-selected
    payload: { value: "option.value", label: "option.label" }
```

## Claims

### exactly-one-option-is-ever-selected

```yaml
kind: unexpressible
```

At any time, at most one rendered `radio-button` reads `checked: true` —
the direct consequence of every instance comparing against the same
shared `selected` cell, but the claim language has no way to quantify
over the set of rendered `each`-instances at all (a distinct gap from
the already-tracked record-domain one — see `docs/material-parity.md`),
so this stays prose. Proven instead by a real, browser-executed
Storybook interaction test
(`examples/material/stories/RadioGroup.stories.tsx`) that clicks one
option and asserts the *other* option's own `aria-checked` flips to
`false` — not just that the clicked one becomes `true`.

## A11y

### radiogroup-pattern

```yaml
kind: pattern-conformance
pattern: radiogroup
```

Conforms to the WAI-ARIA APG radiogroup pattern's container role.

### list-wrapper-delta

```yaml
kind: delta
```

The reused `list` primitive's own `role="list"` wrapper nests inside
this component's `role="radiogroup"` — a deliberate trade for reusing
the `each`-over-a-list-prop container `task-list.md` already proved,
rather than inventing a bespoke, non-semantic wrapper element just for
this component.
