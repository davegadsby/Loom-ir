import { describe, expect, it } from "vitest";
import { Guard, LoomMachine, Transition } from "./machine.js";
import type { MachineConfig } from "./machine.js";
import { parseExpr } from "./parser.js";

describe("Guard", () => {
  it("with no predicate is always satisfied", () => {
    expect(Guard.from(null).isSatisfiedBy({})).toBe(true);
    expect(Guard.from(undefined).isSatisfiedBy({})).toBe(true);
  });

  it("evaluates a real predicate against the given env", () => {
    const guard = Guard.from(parseExpr("not disabled"));
    expect(guard.isSatisfiedBy({ disabled: false })).toBe(true);
    expect(guard.isSatisfiedBy({ disabled: true })).toBe(false);
  });
});

describe("Transition", () => {
  const transition = new Transition({
    id: "toggle-on",
    from: "unchecked",
    to: "checked",
    trigger: { kind: "event", name: "click" },
    guard: Guard.from(parseExpr("not disabled")),
  });

  it("matches when state, event, and guard all agree", () => {
    expect(transition.matches("unchecked", "click", { disabled: false })).toBe(true);
  });

  it("does not match from the wrong state", () => {
    expect(transition.matches("checked", "click", { disabled: false })).toBe(false);
  });

  it("does not match the wrong event name", () => {
    expect(transition.matches("unchecked", "keydown", { disabled: false })).toBe(false);
  });

  it("does not match a non-event trigger kind", () => {
    const keyTransition = new Transition({
      id: "dismiss",
      from: "open",
      to: "closed",
      trigger: { kind: "key", key: "Escape" },
    });
    expect(keyTransition.matches("open", "Escape", {})).toBe(false);
  });

  it("does not match when the guard fails", () => {
    expect(transition.matches("unchecked", "click", { disabled: true })).toBe(false);
  });

  it("always matches when there's no guard", () => {
    const unguarded = new Transition({
      id: "always",
      from: "a",
      to: "b",
      trigger: { kind: "event", name: "go" },
    });
    expect(unguarded.matches("a", "go", {})).toBe(true);
  });
});

const checkboxConfig: MachineConfig = {
  states: [
    { id: "unchecked", disabled: false, focusable: true },
    { id: "checked", disabled: false, focusable: true },
  ],
  transitions: [
    new Transition({
      id: "toggle-on",
      from: "unchecked",
      to: "checked",
      trigger: { kind: "event", name: "click" },
      guard: Guard.from(parseExpr("not disabled")),
    }),
    new Transition({
      id: "toggle-off",
      from: "checked",
      to: "unchecked",
      trigger: { kind: "event", name: "click" },
      guard: Guard.from(parseExpr("not disabled")),
    }),
  ],
};

describe("LoomMachine", () => {
  it("is instantiated from a config whose transitions are pre-built Transition instances", () => {
    const machine = new LoomMachine(checkboxConfig);
    expect(machine.states).toHaveLength(2);
    expect(machine.transitions).toHaveLength(2);
    expect(machine.transitions[0]).toBeInstanceOf(Transition);
    expect(machine.transitions[0]).toBe(checkboxConfig.transitions[0]);
  });

  it("initialState is the first configured state's id", () => {
    expect(new LoomMachine(checkboxConfig).initialState).toBe("unchecked");
  });

  it("throws constructing initialState from a machine with no states", () => {
    const machine = new LoomMachine({ states: [], transitions: [] });
    expect(() => machine.initialState).toThrow(/no states/);
  });

  it("dispatch returns the destination state when a transition matches", () => {
    const machine = new LoomMachine(checkboxConfig);
    expect(machine.dispatch("unchecked", "click", { disabled: false })).toBe("checked");
    expect(machine.dispatch("checked", "click", { disabled: false })).toBe("unchecked");
  });

  it("dispatch returns null when disabled blocks the guard", () => {
    const machine = new LoomMachine(checkboxConfig);
    expect(machine.dispatch("unchecked", "click", { disabled: true })).toBeNull();
  });

  it("dispatch returns null for an event with no matching transition", () => {
    const machine = new LoomMachine(checkboxConfig);
    expect(machine.dispatch("unchecked", "keydown", { disabled: false })).toBeNull();
  });
});
