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

**Keyboard.** `email` is a real `<input>` — natively Tab-reachable and
typeable. Submit is a real `<button>` — Tab-reachable, and Enter/Space
both activate it once `invalid` is false, same guard a mouse click would
hit. No `<form>` wrapper, so Enter inside the field does not submit —
same boundary `login-dialog` states for its own two fields. No
Escape-to-close, no focus trap, same inherited boundary
`confirmation-dialog` already states.

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

### invalid-mirrors-the-email-fields-own-validity

```yaml
kind: property
ident: email
domain: string
predicate: 'not (invalid == matches(email, "^[^\s@]+@[^\s@]+\.[^\s@]+$"))'
```

The claim language reaching the value graph a `derived` value belongs
to (Phase 3): `invalid` is no longer just a named declaration nobody
can check — this samples arbitrary strings for `email`, computes
`invalid` through the exact same `derived`-value mechanism the emitted
components use (field validity, then the `derived` expression, closed
over the sampled value), and asserts it's never equal to whether the
email matches — i.e. `invalid` is exactly `not matches(...)`, restated
as `not (invalid == matches(...))` since this grammar's `not` binds
looser than `==` and can't sit directly on one side of a comparison
(§ loom-expr `parser.ts`'s precedence chain — `not (A == B)` and
`A == not B` are the same predicate for booleans either way). It holds
for *every* string, valid email or not, so — unlike a claim that
needed to filter down to only valid emails — there's no
rejection-sampling risk here (§ Risks: "string-validated fields sample
badly").

Submit's own `disabled` prop is never touched by this claim: `disabled
= {expr: "invalid"}` is a copy of `invalid`'s value by construction
(checked structurally by `checkComposition`, not restated here), so
this claim's real payoff is confirming `invalid` itself computes what
its name promises — the mechanism a claim would need whenever it wants
to reference *any* `derived` value by name.
