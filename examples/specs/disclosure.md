---
name: disclosure
kind: primitive
category: layout
extends: [interactive-base]
---

## Intent

A disclosure widget lets a user reveal or hide a block of content by
activating a trigger — the "show/hide" pattern used by things like
accordion items and expandable panels.

## Rationale

Two named slots (`trigger`, `panel`) rather than a single default slot,
since the trigger and panel play different structural and ARIA roles and
an emitter needs to place them differently in the DOM. `focus-trigger` is
declared as a method because moving focus programmatically is an
imperative action, not something a prop or event can express — and is
left unsupported by the current component backends (§14 step 5's "skip,
don't throw" contract) rather than forced into a shape that doesn't fit.

**Keyboard.** The root itself has no `tabIndex`/keydown handler of its
own — this component's own click toggle is wired on the root's `onClick`,
and keyboard operability is a function of what the *consumer* supplies
into the `trigger` slot, not something disclosure declares itself. A real,
focusable element there (a `<button>`, typically) gets Enter/Space
activation free from the browser exactly like `button.md` does; the
resulting native `click` event bubbles up to this root's own handler and
drives the same toggle a mouse click would. Filling `trigger` with a
non-focusable element (a styled `<span>`, say) would silently produce a
disclosure no keyboard user can operate — a consumer responsibility this
spec can describe but not enforce, since `slotContent` is opaque markup
from this component's own point of view.

## Declarations

### expanded

```yaml
kind: prop
type: bool
default: false
```

Whether the panel is currently revealed.

### toggle

```yaml
kind: event
payloadType: "record{ expanded: bool }"
```

Fired whenever `expanded` changes as a result of user interaction.

### trigger

```yaml
kind: slot
```

The control the user activates to expand or collapse the panel.

### panel

```yaml
kind: slot
```

The content that's shown when `expanded` is true.

### focus-trigger

```yaml
kind: method
returnType: "record{}"
```

Moves focus to the trigger element. No component backend currently
compiles `MethodNode` — imperative methods need a framework-specific
handle (`useImperativeHandle`, a `ViewChild`, ...) that hasn't been
designed yet, so this is skipped with a logged note rather than guessed at.

## Machine

### collapsed

```yaml
kind: state
flags: { disabled: false, focusable: true }
```

### expanded

```yaml
kind: state
flags: { disabled: false, focusable: true }
```

### expand

```yaml
kind: transition
from: collapsed
to: expanded
trigger: { kind: event, name: click }
guard: "not disabled"
```

### collapse

```yaml
kind: transition
from: expanded
to: collapsed
trigger: { kind: event, name: click }
guard: "not disabled"
```

### can-toggle

```yaml
kind: guard
predicate: "not disabled"
```

The same guard both transitions inline — declared standalone here to
show the shape a shared guard takes, even though nothing yet resolves a
transition's `guard` field by reference to a `GuardNode`'s id.

### disabled-locks-collapsed

```yaml
kind: rule
condition: "disabled"
outcome: "not expanded"
```

A decision-table row collapsed to a guarded outcome (§5.2): when
disabled, the panel is not expanded.

## Claims

### expanding-requires-not-disabled

```yaml
kind: invariant
predicate: "implies(expanded, not disabled)"
```

A disclosure can't be expanded while disabled.

### click-expands-a-collapsed-panel

```yaml
kind: scenario
from: collapsed
events:
  - { kind: event, name: click }
to: expanded
```

A single click on a collapsed, enabled disclosure expands it.

### click-collapses-an-expanded-panel

```yaml
kind: scenario
from: expanded
events:
  - { kind: event, name: click }
to: collapsed
```

A single click on an expanded, enabled disclosure collapses it.

### transitions-stay-within-declared-states

```yaml
kind: property
ident: t
domain: "transitions"
predicate: "t.to in states"
```

The same claim shape checkbox uses (§4) — proof it's a repeatable idiom,
not a one-off.

## A11y

### disclosure-pattern

```yaml
kind: pattern-conformance
pattern: disclosure
```

Conforms to the WAI-ARIA APG Disclosure (Show/Hide Content) pattern.

### panel-relation

```yaml
kind: aria-relation
relation: aria-controls
```

The trigger's `aria-controls` references the panel's id, and
`aria-expanded` on the trigger mirrors `expanded`.

### focus-not-trapped-delta

```yaml
kind: delta
```

Unlike some accordion implementations, focus is not moved into the panel
on expand — the trigger retains focus so keyboard users aren't
unexpectedly relocated.
