---
name: dismiss-banner
kind: primitive
category: feedback
---

## Intent

An inline status banner the user can dismiss without reaching for a
mouse — the first component to declare a *keyboard* trigger
(`EventNode.trigger` with `kind: "key"`, § Phase 5d) rather than a
`kind: "event"` one.

## Rationale

`button.md`'s `press` already proved `EventNode.trigger` for a
`kind: "event"` (click) trigger (§ Phase 5a) — but a real `<button>`
already gets Enter/Space activation for free from the browser (§ Phase
5b), so adding a redundant key trigger there would double-fire the same
callback on a real Enter press (native click-synthesis *and* a manually
wired keydown guard both calling `onPress`). `checkbox`/`disclosure`
aren't a fit either: their own declared events (`change`/`toggle`) are
only ever fired by a *machine* transition today, and `LoomMachine`'s
`Transition.matches` still hardcodes `trigger.kind === "event"` (§ Phase
5a's own documented gap) — wiring a key trigger onto a machine-backed
event there would emit code that can never actually match. `dismiss`
here has no machine at all, exactly like `press-widget`'s shape for
click triggers: the declared event's `trigger` is the *only* thing that
fires it.

`lowerRootHandlers` gives the root `tabIndex={0}`/`tabindex="0"`
whenever a `key` trigger is present — a keydown handler is inert on an
element that can never receive focus. That's the honest limit of this
mechanism, not a nice-to-have: it makes the root *focusable* (reachable
by Tab, or by a real accessibility tree), but does not move focus there
automatically. A banner that should grab focus the moment it appears
(so a keyboard user doesn't have to Tab to it first) needs autofocus-
on-mount, which is separate, undone scope — same boundary `confirmation-
dialog`'s own Rationale already draws around focus-trapping.

## Declarations

### default

```yaml
kind: slot
```

The banner's message content.

### dismissed

```yaml
kind: event
payloadType: "record{}"
trigger: { kind: key, key: Escape }
```

Fired when the banner has focus and Escape is pressed.

## Claims

### escape-only-dismisses-not-other-keys

```yaml
kind: unexpressible
```

That pressing any key other than Escape leaves the banner exactly as it
was is a real, checkable property in principle, but the claim language
quantifies over `states`/`transitions` (`PathNode`/`PropertyNode`) or
the value graph (`derived`) — neither of which a root-level DOM keydown
guard is expressed through. `examples/tests/render.test.tsx` proves this
behaviorally instead (a non-Escape keydown does not fire `dismissed`; an
Escape keydown does) — the render-level test this taxonomy's claim
language can't yet subsume, same honest boundary `confirmation-dialog`'s
own `unexpressible` claim already draws for its own composed behavior.

## A11y

### alert-pattern

```yaml
kind: pattern-conformance
pattern: alert
```

Conforms to the WAI-ARIA APG alert pattern.
