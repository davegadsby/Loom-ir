// @vitest-environment jsdom
/**
 * Renders the COMMITTED generated components and asserts they actually behave.
 *
 * This is the regression net the repo did not have. `examplesUpToDate.test.ts`
 * proves the emitted *text* is unchanged; it has never proved the text compiles,
 * mounts, or responds to a click. Once the emitters are refactored, byte-equality
 * stops applying — these tests are what carries the guarantee forward.
 *
 * Tests marked `it.fails` document defects that exist in the compiler today. They
 * are not skips: vitest fails the suite if one of them starts passing, so each is
 * a live tripwire that tells us the moment a fix lands.
 */
import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { Checkbox } from "../generated/react/Checkbox";
import { Button } from "../generated/react/Button";
import { LoginDialog } from "../generated/react/LoginDialog";
import { ConfirmationDialog } from "../generated/react/ConfirmationDialog";
import { SignupDialog } from "../generated/react/SignupDialog";
import { TaskList } from "../generated/react/TaskList";

afterEach(cleanup);

describe("Checkbox — machine-backed interaction", () => {
  it("starts in the machine's initial state", () => {
    const { getByRole } = render(<Checkbox />);
    expect(getByRole("checkbox").getAttribute("data-state")).toBe("unchecked");
  });

  it("toggles state on click, driving the embedded LoomMachine end to end", () => {
    const { getByRole } = render(<Checkbox />);
    const el = getByRole("checkbox");
    fireEvent.click(el);
    expect(el.getAttribute("data-state")).toBe("checked");
    fireEvent.click(el);
    expect(el.getAttribute("data-state")).toBe("unchecked");
  });

  it("respects the transition guard: a disabled checkbox does not toggle", () => {
    const { getByRole } = render(<Checkbox disabled />);
    const el = getByRole("checkbox");
    fireEvent.click(el);
    expect(el.getAttribute("data-state")).toBe("unchecked");
  });
});

describe("LoginDialog — native fields and live validation", () => {
  const usernameInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[name="username"]')!;
  const passwordInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[name="password"]')!;
  const errorFor = (c: HTMLElement, field: string) => c.querySelector(`[data-loom-field-error="${field}"]`);

  it("renders both fields, with the password field masked", () => {
    const { container } = render(<LoginDialog />);
    expect(usernameInput(container).type).toBe("text");
    expect(passwordInput(container).type).toBe("password");
  });

  it("shows no error before the field is touched, even though it is empty and invalid", () => {
    const { container } = render(<LoginDialog />);
    expect(errorFor(container, "username")).toBeNull();
    expect(errorFor(container, "password")).toBeNull();
  });

  it("shows the error once touched and invalid, then clears it when the value becomes valid", () => {
    const { container } = render(<LoginDialog />);
    const input = usernameInput(container);

    fireEvent.change(input, { target: { value: "nope" } });
    expect(errorFor(container, "username")?.textContent).toBe("Enter a valid email address.");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(input, { target: { value: "a@b.co" } });
    expect(errorFor(container, "username")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("enforces the 8-character password rule live", () => {
    const { container } = render(<LoginDialog />);
    const input = passwordInput(container);

    fireEvent.change(input, { target: { value: "short" } });
    expect(errorFor(container, "password")?.textContent).toBe("Password must be at least 8 characters.");

    fireEvent.change(input, { target: { value: "longenough" } });
    expect(errorFor(container, "password")).toBeNull();
  });

  it("computes Login's disabled prop across BOTH fields — the cross-component computed value", () => {
    const { container } = render(<LoginDialog />);
    const login = () => container.querySelectorAll('[data-loom-component="button"]')[0]!;

    expect(login().getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(usernameInput(container), { target: { value: "a@b.co" } });
    expect(login().getAttribute("aria-disabled")).toBe("true"); // password still invalid

    fireEvent.change(passwordInput(container), { target: { value: "longenough" } });
    expect(login().getAttribute("aria-disabled")).toBe("false"); // both valid
  });
});

describe("SignupDialog — an authored derived value, cross-referenced from a composed prop", () => {
  const emailInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[name="email"]')!;
  const submitButton = (c: HTMLElement) => c.querySelectorAll('[data-loom-component="button"]')[0]!;

  it("computes the named `invalid` derived value from the field's own validity, disabling Submit through it", () => {
    const { container } = render(<SignupDialog />);
    expect(submitButton(container).getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(emailInput(container), { target: { value: "not-an-email" } });
    expect(submitButton(container).getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(emailInput(container), { target: { value: "a@b.co" } });
    expect(submitButton(container).getAttribute("aria-disabled")).toBe("false");
  });

  it("shows and clears the field error live, same as LoginDialog's own fields", () => {
    const { container } = render(<SignupDialog />);
    const input = emailInput(container);
    const error = () => container.querySelector('[data-loom-field-error="email"]');

    expect(error()).toBeNull();
    fireEvent.change(input, { target: { value: "nope" } });
    expect(error()?.textContent).toBe("Enter a valid email address.");
    fireEvent.change(input, { target: { value: "a@b.co" } });
    expect(error()).toBeNull();
  });
});

describe("TaskList — each: one rendered instance per element of a list-typed prop", () => {
  const items = (c: HTMLElement) => c.querySelectorAll('[data-loom-component="list-item"]');

  it("renders zero list-item instances for the default (empty) tasks", () => {
    const { container } = render(<TaskList />);
    expect(items(container)).toHaveLength(0);
  });

  it("renders exactly one list-item instance per element of tasks — proves .map() genuinely iterates, not a fixed-arity render", () => {
    const tasks = [
      { id: "a", label: "Buy milk", done: false },
      { id: "b", label: "Walk dog", done: true },
      { id: "c", label: "Write report", done: false },
    ];
    const { container } = render(<TaskList tasks={tasks} />);
    expect(items(container)).toHaveLength(3);
  });

  it("re-renders to match a changed tasks array, in either direction — confirms this is live iteration, not something computed once", () => {
    const { container, rerender } = render(<TaskList tasks={[{ id: "a", label: "One", done: false }]} />);
    expect(items(container)).toHaveLength(1);

    rerender(
      <TaskList
        tasks={[
          { id: "a", label: "One", done: false },
          { id: "b", label: "Two", done: false },
          { id: "c", label: "Three", done: true },
        ]}
      />
    );
    expect(items(container)).toHaveLength(3);

    rerender(<TaskList tasks={[]} />);
    expect(items(container)).toHaveLength(0);
  });

  it("each rendered list-item conforms to the WAI-ARIA listitem pattern, same as any other list-item instance", () => {
    const { container } = render(<TaskList tasks={[{ id: "a", label: "One", done: false }]} />);
    expect(items(container)[0]!.getAttribute("role")).toBe("listitem");
  });
});

describe("known defects in the current compiler", () => {
  it.fails("Button should invoke onPress when clicked, but emits no click handler at all", () => {
    let pressed = false;
    const { getByRole } = render(<Button onPress={() => { pressed = true; }}>Go</Button>);
    fireEvent.click(getByRole("button"));
    expect(pressed).toBe(true);
  });

  it.fails("ConfirmationDialog should fire onClosed when Confirm is pressed — its entire stated behavior", () => {
    let closed = false;
    const { container } = render(<ConfirmationDialog open onClosed={() => { closed = true; }} />);
    fireEvent.click(container.querySelector('[data-loom-component="button"]')!);
    expect(closed).toBe(true);
  });

  it.fails("LoginDialog should fire onLogin with the typed credentials when Login is pressed", () => {
    const seen: Array<{ username: string; password: string }> = [];
    const { container } = render(<LoginDialog onLogin={(p) => seen.push(p)} />);

    const u = container.querySelector<HTMLInputElement>('input[name="username"]')!;
    const p = container.querySelector<HTMLInputElement>('input[name="password"]')!;
    fireEvent.change(u, { target: { value: "a@b.co" } });
    fireEvent.change(p, { target: { value: "longenough" } });
    fireEvent.click(container.querySelectorAll('[data-loom-component="button"]')[0]!);

    expect(seen).toEqual([{ username: "a@b.co", password: "longenough" }]);
  });

  it.fails("SignupDialog should fire onSubscribed with the typed email when Submit is pressed — same root cause as the other two", () => {
    const seen: Array<{ email: string }> = [];
    const { container } = render(<SignupDialog onSubscribed={(p) => seen.push(p)} />);

    fireEvent.change(container.querySelector<HTMLInputElement>('input[name="email"]')!, { target: { value: "a@b.co" } });
    fireEvent.click(container.querySelectorAll('[data-loom-component="button"]')[0]!);

    expect(seen).toEqual([{ email: "a@b.co" }]);
  });
});
