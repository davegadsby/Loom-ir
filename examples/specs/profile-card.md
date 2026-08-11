---
name: profile-card
kind: primitive
category: display
---

## Intent

A card whose content depends on an async-fetched profile — the first
example spec to declare a `resource` (§ Phase 5c). Exists to prove
`resource` reaches the value graph exactly the way a `list<T>` prop
already does for `each` (`task-list`'s `tasks`) and for `derived`
(`signup-dialog`'s `email`), just declared under a distinct kind.

## Rationale

`resource` is deliberately the smallest possible v1: a named, typed
async value exposed to the value graph as `list<dataType>` — 0 elements
before load, 1 once loaded. This spec never fetches anything and never
represents loading/error state; those are real, separate mechanisms
(which effect kind triggers a fetch, how the result lands back in this
list) left for whenever a real example needs them. What `resource` adds
over a plain `list<T>` prop is *only* the declaration kind itself — a
`derived` value or a claim can address it by name and know it represents
one loaded item, not an arbitrary collection.

`loaded` is `not isEmpty(profile)` — the same shape `task-list`'s
`nonempty` used for its own `list<T>` prop, now proven for a `resource`
instead.

## Declarations

### profile

```yaml
kind: resource
dataType: "record{name: string, email: string}"
```

### loaded

```yaml
kind: derived
type: bool
expr: "not isEmpty(profile)"
```

Whether `profile` currently holds a loaded item. Computed the same way
any other `derived` value is — nothing about `resource` needed a new
evaluation mechanism.

## Claims

### loaded-mirrors-whether-profile-is-empty

```yaml
kind: property
ident: profile
domain: "list<int> size(0, 3)"
predicate: "not (loaded == isEmpty(profile))"
```

Samples an arbitrary (possibly empty) list and binds it to `profile`,
computes `loaded` through the actual `derived`-value mechanism, and
asserts it's always the opposite of `isEmpty(profile)` — the identical
pattern `task-list`'s `nonempty-mirrors-whether-the-list-is-empty` claim
already proved for a `prop`, now proved for a `resource`.

The sampled elements are `int`, not `record{name, email}` like
`profile`'s real declared `dataType` — the same surface-grammar
substitution `task-list`'s claim already documents (`list<record{...}>`
can't be written as a claim domain today; `isEmpty` only ever reads
length, so a length-preserving stand-in proves exactly the same thing).
The domain is capped at 3 rather than `task-list`'s 5 as a small,
honest nod to `resource`'s own intent — 0-or-1 in the shape this feature
actually produces — while still exercising more-than-one-element inputs
this pass doesn't structurally forbid.
