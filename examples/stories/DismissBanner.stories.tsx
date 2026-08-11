import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, expect, fn } from "storybook/test";
import { DismissBanner } from "../generated/react/DismissBanner";

/**
 * Hand-authored, not generated — `dismiss-banner` has no Machine, so no
 * `ScenarioNode` exists to drive a story from (its `dismissed` event
 * fires off its own declared `kind: "key"` trigger, not a transition).
 * The real-browser counterpart to `examples/tests/render.test.tsx`'s
 * existing jsdom test for the same behavior — `dismiss-banner.md`'s own
 * "Keyboard" note is what this proves.
 */
const meta: Meta<typeof DismissBanner> = {
  component: DismissBanner,
  title: "Keyboard/DismissBanner",
  args: { onDismissed: fn() },
  render: (args) => <DismissBanner {...args}>Something happened.</DismissBanner>,
};
export default meta;
type Story = StoryObj<typeof DismissBanner>;

export const EscapeDismissesIt: Story = {
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-loom-component="dismiss-banner"]')!;
    fireEvent.keyDown(root, { key: "Escape" });
    await expect(args.onDismissed).toHaveBeenCalledTimes(1);
  },
};

export const OtherKeysDoNotDismissIt: Story = {
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-loom-component="dismiss-banner"]')!;
    fireEvent.keyDown(root, { key: "Enter" });
    fireEvent.keyDown(root, { key: "a" });
    await expect(args.onDismissed).not.toHaveBeenCalled();
  },
};

export const IsFocusable: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-loom-component="dismiss-banner"]')!;
    await expect(root.getAttribute("tabindex")).toBe("0");
  },
};
