import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, expect, fn } from "storybook/test";
import { LoginDialog } from "../generated/react/LoginDialog";

/**
 * Hand-authored, not generated — `login-dialog`'s own
 * `validity-gated-enablement-is-unexpressible` claim explains precisely why:
 * Login's live enablement is a `{expr}` computed prop over two fields' own
 * validity, and no `ScenarioNode` can trace a walk over that (it only walks
 * `states`/`transitions`, and this component has neither). Proven here
 * instead, in a real browser, exactly as that claim's own text asks for.
 */
const meta: Meta<typeof LoginDialog> = {
  component: LoginDialog,
  title: "Composites/LoginDialog",
  args: { onLogin: fn(), onClosed: fn() },
};
export default meta;
type Story = StoryObj<typeof LoginDialog>;

export const ValidityGatedEnablement: Story = {
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-loom-component="login-dialog"]')!;
    const username = root.querySelector<HTMLInputElement>('input[name="username"]')!;
    const password = root.querySelector<HTMLInputElement>('input[name="password"]')!;
    const login = root.querySelectorAll<HTMLButtonElement>('[data-loom-component="button"]')[0]!;

    await expect(login.disabled).toBe(true);

    await userEvent.type(username, "not-an-email");
    await userEvent.type(password, "longenough123");
    await expect(login.disabled).toBe(true);

    await userEvent.clear(username);
    await userEvent.type(username, "a@b.co");
    await expect(login.disabled).toBe(false);

    await userEvent.click(login);
    await expect(args.onLogin).toHaveBeenCalledWith({ username: "a@b.co", password: "longenough123" });
    await expect(args.onClosed).toHaveBeenCalledTimes(1);
  },
};

export const LoginIsKeyboardOperableOnceEnabled: Story = {
  play: async ({ canvasElement, args }) => {
    // `login-dialog.md`'s own "Keyboard" note: both fields are natively
    // Tab-reachable/typeable, and Login/Cancel are real `<button>`s —
    // Tab-reachable, Enter/Space-operable once Login is enabled. No
    // `<form>` wrapper, so this deliberately types values in directly
    // rather than pressing Enter inside a field (which does not submit).
    const root = canvasElement.querySelector('[data-loom-component="login-dialog"]')!;
    const username = root.querySelector<HTMLInputElement>('input[name="username"]')!;
    const password = root.querySelector<HTMLInputElement>('input[name="password"]')!;
    const login = root.querySelectorAll<HTMLButtonElement>('[data-loom-component="button"]')[0]!;

    await userEvent.type(username, "a@b.co");
    await userEvent.type(password, "longenough123");
    await expect(login.disabled).toBe(false);

    login.focus();
    await userEvent.keyboard(" ");
    await expect(args.onLogin).toHaveBeenCalledWith({ username: "a@b.co", password: "longenough123" });
    await expect(args.onClosed).toHaveBeenCalledTimes(1);
  },
};
