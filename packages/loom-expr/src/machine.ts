import type { Expr } from "./ast.js";
import type { Env } from "./context.js";
import { evaluate } from "./evaluate.js";

export interface TriggerConfig {
  kind: "key" | "event" | "pointer";
  key?: string;
  context?: string;
  name?: string;
}

export interface StateConfig {
  id: string;
  [flag: string]: unknown;
}

export interface TransitionConfig {
  id: string;
  from: string;
  to: string;
  trigger: TriggerConfig;
  guard?: Expr | null;
}

export interface MachineConfig {
  states: StateConfig[];
  transitions: TransitionConfig[];
}

/**
 * Wraps a transition's optional guard `Expr`. A transition with no guard is
 * always satisfied — `!t.guard || evaluate(t.guard, env)` collapsed into one
 * call site instead of being re-derived inline by every emitter.
 */
export class Guard {
  private constructor(private readonly predicate: Expr | null) {}

  static from(predicate: Expr | null | undefined): Guard {
    return new Guard(predicate ?? null);
  }

  isSatisfiedBy(env: Env): boolean {
    return this.predicate === null || evaluate(this.predicate, env) === true;
  }
}

/** One edge of the machine: which event, from which state, under which guard. */
export class Transition {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly trigger: TriggerConfig;
  readonly guard: Guard;

  constructor(config: TransitionConfig) {
    this.id = config.id;
    this.from = config.from;
    this.to = config.to;
    this.trigger = config.trigger;
    this.guard = Guard.from(config.guard);
  }

  /** True if this transition fires for `eventName` out of `currentState`, given `env`. */
  matches(currentState: string, eventName: string, env: Env): boolean {
    return (
      this.from === currentState &&
      this.trigger.kind === "event" &&
      this.trigger.name === eventName &&
      this.guard.isSatisfiedBy(env)
    );
  }
}

/**
 * Runtime state machine compiled from a component's states/transitions
 * (§5.3), instantiated from the plain config data an emitter embeds.
 * `dispatch` finds the (if any) transition whose event and guard match, and
 * is the one place that logic lives — loom-emit-react and loom-emit-angular
 * previously each inlined an untyped `.find()` call doing this by hand.
 * Only `kind: "event"` triggers currently dispatch; `key`/`pointer` triggers
 * are recognized in config but not yet wired to a dispatch path.
 */
export class LoomMachine {
  readonly states: readonly StateConfig[];
  readonly transitions: readonly Transition[];

  constructor(config: MachineConfig) {
    this.states = config.states;
    this.transitions = config.transitions.map((t) => new Transition(t));
  }

  get initialState(): string {
    const first = this.states[0];
    if (!first) throw new Error("LoomMachine has no states");
    return first.id;
  }

  /** The next state id for `eventName` fired from `currentState`, or `null` if nothing matches. */
  dispatch(currentState: string, eventName: string, env: Env): string | null {
    const transition = this.transitions.find((t) => t.matches(currentState, eventName, env));
    return transition ? transition.to : null;
  }
}
