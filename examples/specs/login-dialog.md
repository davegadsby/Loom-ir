---
name: login-dialog
kind: composite
category: overlay
---

## Intent

The classic login pattern — an email-validated username field, a
password field requiring 8+ characters, and a Login button enabled
only when both are currently valid — composed from the same `dialog`
and `button` primitives `confirmation-dialog` reuses, plus two native
`FieldNode`s this component renders and manages itself.

## Rationale

`username`/`password` are `FieldNode`s, not composed sub-components:
they're native text inputs with local, per-keystroke state (value +
"touched"), not separately-compiled components. Each carries its own
`validate` expression (`matches(...)` for the email shape, `len(...)
>= 8` for the password) and `invalidMessage`, shown only once that
field has been touched and is currently invalid — the message
disappears the moment the field becomes valid, since it's a live
re-evaluation on every keystroke, not a one-time check.

`login-button`'s `disabled` prop is a `{expr}` computed value —
`not (usernameValid and passwordValid)` — live-evaluated against this
component's own field-derived validity at render time, so Login only
enables once both inputs pass. Pressing Login fires two of this
component's own events off one click: `login` (carrying the current
`username`/`password` as its payload — the multi-target `on` wiring's
`payload` map sources both from the sibling fields) and `closed`.
Cancel only fires `closed`, via the same bare-string `on` sugar
`confirmation-dialog`'s Confirm button already uses.

Like `confirmation-dialog`, this component has no `Machine` section —
its behavior is expressed entirely through native field state,
`{expr}` computed props, and `on` wiring, none of which a
`LoomMachine` or `states`/`transitions` would add anything to.

## Declarations

### username

```yaml
kind: field
validate: 'matches(username, "^[^\s@]+@[^\s@]+\.[^\s@]+$")'
invalidMessage: "Enter a valid email address."
```

### password

```yaml
kind: field
secret: true
validate: "len(password) >= 8"
invalidMessage: "Password must be at least 8 characters."
```

### login

```yaml
kind: event
payloadType: "record{username: string, password: string}"
```

Fired when Login is pressed while both fields are valid, carrying
their current values.

### closed

```yaml
kind: event
payloadType: "record{}"
```

Fired when either Login or Cancel is pressed.

## Composition

### dialog-instance

```yaml
kind: uses
component: dialog
root: true
slotContent:
  title:
    text: "Sign in"
  body:
    fields: [username, password]
  actions:
    uses: [login-button, cancel-button]
```

### login-button

```yaml
kind: uses
component: button
props:
  variant: primary
  disabled:
    expr: "not (usernameValid and passwordValid)"
slotContent:
  default:
    text: "Login"
on:
  press:
    - event: login
      payload:
        username: username
        password: password
    - event: closed
```

### cancel-button

```yaml
kind: uses
component: button
props:
  variant: secondary
slotContent:
  default:
    text: "Cancel"
on:
  press: closed
```

## Claims

### validity-gated-enablement-is-unexpressible

```yaml
kind: unexpressible
```

`login-dialog` has no `states`/`transitions` of its own — Login's
live enablement is a `{expr}` computed prop over field-derived
validity, and each field's error message is local render logic, not a
transition. Neither is something the `PathNode`/`PropertyNode` claim
language (which quantifies over a `states`/`transitions` domain) can
currently reference. Verifying "Login only enables once both fields
are valid" and "the error message tracks live validity" end-to-end
would need an interaction-level test (Storybook play / e2e) outside
this taxonomy's current reach.
