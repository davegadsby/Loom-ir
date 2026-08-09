---
name: confirmation-dialog
kind: composite
category: overlay
---

## Intent

A confirmation dialog composes `dialog` and `button` into the single
compound component an app actually renders — the "harder test" case:
a component whose own generated output imports and instantiates two
other generated components.

## Rationale

It can be opened, and can only be closed by clicking its Confirm
button — there is no Cancel affordance in this example. `open` is a
standard controlled-component prop (the consumer decides when it's
shown, same idea as a native `<dialog open>` attribute); `opened` and
`closed` are events a consumer subscribes to. `opened` fires
automatically whenever `open` transitions to `true` (`firesWhen`);
`closed` fires only when the embedded Confirm button is pressed,
wired directly from that button's own `press` event via composition
(`on: { press: closed }`) — nothing else in the composed tree is wired
to fire it, which is the literal mechanism realizing "only Confirm
closes it." This component deliberately has no `Machine` section: its
behavior is expressed entirely through `firesWhen` and `on` wiring,
neither a `LoomMachine` nor `states`/`transitions` of its own.

## Declarations

### open

```yaml
kind: prop
type: bool
default: false
```

Whether the dialog is currently shown. Controlled by the consumer.

### opened

```yaml
kind: event
payloadType: "record{}"
firesWhen:
  prop: open
  becomes: true
```

Fired whenever `open` transitions to `true`.

### closed

```yaml
kind: event
payloadType: "record{}"
```

Fired when the Confirm button inside is clicked.

## Composition

### dialog-instance

```yaml
kind: uses
component: dialog
root: true
visibleWhen: open
slotContent:
  title:
    text: "Confirm Deletion"
  body:
    text: "This action cannot be undone. Are you sure you want to delete this item?"
  actions:
    uses: [confirm-button]
```

### confirm-button

```yaml
kind: uses
component: button
props:
  variant: primary
slotContent:
  default:
    text: "Confirm"
on:
  press: closed
```

## Claims

### confirm-closes-the-dialog

```yaml
kind: unexpressible
```

`confirmation-dialog` has no `states`/`transitions` of its own — its
open/close behavior is expressed entirely through `open`'s `firesWhen`
and the Confirm button's `on` wiring, neither of which the
`PathNode`/`PropertyNode` claim language (which quantifies over a
`states`/`transitions` domain) can currently reference. Verifying
"only Confirm closes the dialog" end-to-end would need an
interaction-level test (Storybook play / e2e) outside this taxonomy's
current reach.
