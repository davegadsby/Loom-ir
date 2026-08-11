import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, expect, fn } from "storybook/test";
import { ConfirmationDialog } from "../generated/react/ConfirmationDialog";

/**
 * Hand-authored, not generated — `confirmation-dialog`'s own
 * `confirm-closes-the-dialog` claim explains precisely why: its open/close
 * behavior is expressed entirely through `open`'s `firesWhen` and the
 * Confirm button's `on` wiring, neither of which a `ScenarioNode` (which
 * only walks `states`/`transitions`, and this component has neither) can
 * reach. Proven here instead, in a real browser, exactly as that claim's
 * own text asks for.
 *
 * Scoped to what's reliably provable across two mounted stories with fixed
 * `open` values — `visibleWhen`'s gate (closed vs. open) and "only Confirm
 * closes it." `firesWhen`'s own transition-on-change behavior (`opened`
 * firing only when `open` flips from false to true, never on mount) would
 * need a live prop update mid-`play`, which isn't a gap this story closes;
 * `examples/tests/render.test.tsx` doesn't cover it either — a real,
 * pre-existing, documented gap, not something silently skipped here.
 */
const meta: Meta<typeof ConfirmationDialog> = {
  component: ConfirmationDialog,
  title: "Composites/ConfirmationDialog",
  args: { onOpened: fn(), onClosed: fn() },
};
export default meta;
type Story = StoryObj<typeof ConfirmationDialog>;

const hasDialogContent = (root: Element) => root.querySelector('[data-loom-component="dialog"]') !== null;

export const ClosedByDefault: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-loom-component="confirmation-dialog"]')!;
    await expect(hasDialogContent(root)).toBe(false);
  },
};

export const OpenShowsDialogAndConfirmCloses: Story = {
  args: { open: true },
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-loom-component="confirmation-dialog"]')!;
    await expect(hasDialogContent(root)).toBe(true);

    // "Can only be closed by clicking Confirm" — the claim's own headline: nothing
    // else in the composed tree is wired to fire `closed`.
    const confirm = root.querySelector<HTMLButtonElement>('[data-loom-component="button"]')!;
    await userEvent.click(confirm);
    await expect(args.onClosed).toHaveBeenCalledTimes(1);
  },
};

export const ConfirmIsKeyboardOperable: Story = {
  args: { open: true },
  play: async ({ canvasElement, args }) => {
    // `confirmation-dialog.md`'s own "Keyboard" note: Confirm is a real
    // `<button>`, Tab-reachable and Enter/Space-operable — no separate
    // keyboard path needed, and no Escape-to-close exists (deliberate).
    const root = canvasElement.querySelector('[data-loom-component="confirmation-dialog"]')!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-loom-component="button"]')!;
    confirm.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClosed).toHaveBeenCalledTimes(1);
  },
};
