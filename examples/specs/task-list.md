---
name: task-list
kind: composite
category: layout
---

## Intent

A list of tasks, each rendered as a `list-item` — the first component in
this repo whose composed content isn't a fixed set of named instances but
one instance repeated once per element of a list-typed prop. Composed
from the same `list`/`list-item` primitives, reusing `each` (§ Phase 4)
rather than a fixed slotContent shape.

## Rationale

Every composed component before this one names each of its children
individually in the Composition section (`login-button`, `submit-button`,
...) — there's exactly one of each, known at spec-authoring time. A task
list can't be authored that way: the number of tasks is only known at
render time, from whatever `tasks` the consumer passes in. `each` is the
one mechanism the composition surface has for that — `item-template`
(a `list-item` `uses` node) is declared once, the same way any other
child is, but instantiated once per element of `tasks` rather than
exactly once; its own `label`/`done` props are `{expr}`s referencing
`task`, the bound name `each.as` introduces, checked against `tasks`'
own declared element type the same way any other `{expr}` prop is typed
(`checkComposition`'s `bound` extension — § Phase 4).

`nonempty` is a `derived` value computed from `tasks` itself
(`not isEmpty(tasks)`) — not consumed by anything in this spec's
Composition section (there's no empty-state message to gate here), but
declared to give Claims something to reach: the payoff of `derived`
reaching a *list*-typed free input, not just a string one (`signup-dialog`
already proved this for a string field — § Phase 3). Named as one word,
deliberately — see `nonempty`'s own declaration below for why.

## Declarations

### tasks

```yaml
kind: prop
type: "list<record{id: string, label: string, done: bool}>"
default: []
```

### nonempty

```yaml
kind: derived
type: bool
expr: "not isEmpty(tasks)"
```

Named as a single word, not `has-tasks` — the same `loom-expr` hyphen-
lexer gap `DerivedNode`'s own doc comment already tracks means a
hyphenated name can be *declared* but never *referenced* from expression
text. This one needs referencing, from the claim below.

## Composition

### list-instance

```yaml
kind: uses
component: list
root: true
slotContent:
  default:
    each:
      over: tasks
      as: task
      use: item-template
      key: id
```

### item-template

```yaml
kind: uses
component: list-item
props:
  label:
    expr: "task.label"
  done:
    expr: "task.done"
```

## Claims

### nonempty-mirrors-whether-the-list-is-empty

```yaml
kind: property
ident: tasks
domain: "list<int> size(0, 5)"
predicate: "not (nonempty == isEmpty(tasks))"
```

Samples an arbitrary (possibly empty) list and binds it to `tasks`,
computes `nonempty` through the actual `derived`-value mechanism (closed
over the sampled list — the same `__buildEnv` construction
`signup-dialog`'s claim exercises for a string field, now exercised for
a list-typed free input), and asserts it's always the opposite of
`isEmpty(tasks)`. True for every list, empty or not.

The sampled elements are `int`, not `record{id, label, done}` like
`tasks`'s real declared type — a newly-discovered gap, not a shortcut
taken for convenience: the domain *surface grammar* (`loom-expr`'s
`parseDomainClause`) only recognizes `bool`/`int`/`float`/`string` as a
base `type` domain, so `list<record{...}>` cannot be *written* as a
claim's domain today, even though the underlying `Domain`/
`domainToArbitrary` machinery already samples an arbitrary `LoomType`
generically via `{kind: "type", type: LoomType}` — this is a surface-
grammar hole, not a semantic one, and extending it is real, separate
`loom-expr` parser work Phase 4 didn't take on. Substituting `int`
elements doesn't weaken this claim: `isEmpty` — everything `nonempty`
depends on — only ever reads `tasks`'s length, never an element's shape,
so a length-preserving stand-in domain proves exactly the same thing a
`record`-shaped one would.

This claim is deliberately about the free input (`tasks`) as a whole,
not about each rendered item — quantifying over the list's own
*elements* (`all (x in tasks) ...`) is still a parse error in this
grammar (§ Context point 3: a quantifier's binder is a closed,
constructive `Domain`, and nothing steps from a list-valued expression
into its elements yet). Closing that gap is future work, not required
to prove `each` itself: the render tree already renders every element
regardless, and this claim already proves the value graph reaches the
list *as a value*.
