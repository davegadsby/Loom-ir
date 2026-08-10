---
name: signup-dialog
kind: composite
category: overlay
---

## Intent

A minimal newsletter-signup pattern — one email field and a Submit
button enabled only once that field is valid — composed from the same
`dialog` and `button` primitives `login-dialog` reuses. Exists to
demonstrate `derived`: a named, typed value computed from this
component's own declarations, rather than an anonymous `{expr}`
repeated wherever it's needed.

## Rationale

`login-dialog`'s Login button computes its `disabled` prop as an
anonymous, inline `{expr}` — `not (usernameValid and passwordValid)` —
written once, at the one place it's used. `invalid` here is the same
kind of computation, but named: declared once, under Declarations,
with its own type and id, then *referenced* — by that name — from
Submit's `{expr}` prop, instead of repeating the expression. Nothing
about what gets rendered changes; what changes is that the computation
now has a stable identity of its own, separate from any one place that
happens to consume it.

`email` is a `FieldNode`, exactly like `login-dialog`'s fields: native
local state, its own `validate`, its own `invalidMessage`. `invalid`
is computed from that field's derived `emailValid` — `not emailValid` —
and could just as well have combined that with another prop or field
had this component needed to; a `derived` value's `expr` is checked
against this component's own props and fields, the same context an
`{expr}` composed prop already had.

Like `login-dialog`, this component has no `Machine` section.

## Declarations

### email

```yaml
kind: field
validate: 'matches(email, "^[^\s@]+@[^\s@]+\.[^\s@]+$")'
invalidMessage: "Enter a valid email address."
```

### invalid

```yaml
kind: derived
type: bool
expr: "not emailValid"
```

Whether the current email is invalid — named so Submit's `disabled`
prop can reference it instead of repeating the expression.

### subscribed

```yaml
kind: event
payloadType: "record{email: string}"
```

Fired when Submit is pressed, carrying the current email.

## Composition

### dialog-instance

```yaml
kind: uses
component: dialog
root: true
slotContent:
  title:
    text: "Subscribe"
  body:
    fields: [email]
  actions:
    uses: [submit-button]
```

### submit-button

```yaml
kind: uses
component: button
props:
  variant: primary
  disabled:
    expr: "invalid"
slotContent:
  default:
    text: "Subscribe"
on:
  press:
    - event: subscribed
      payload:
        email: email
```

## Claims

### validity-gated-enablement-is-unexpressible

```yaml
kind: unexpressible
```

`signup-dialog` has no `states`/`transitions` of its own, so the
`PathNode`/`PropertyNode` claim language (which quantifies over a
`states`/`transitions` domain) can't yet reference `invalid`, even
though it's now a named, addressable declaration — the claim language
reaching the value graph a `derived` value belongs to is a real gap,
not yet closed. Verifying "Submit only enables once the email is
valid" end-to-end would need an interaction-level test (Storybook
play / e2e) outside this taxonomy's current reach.
