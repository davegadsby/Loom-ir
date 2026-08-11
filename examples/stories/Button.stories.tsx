import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, expect, fn } from "storybook/test";
import { Button } from "../generated/react/Button";

/**
 * Hand-authored, not generated — `button` has no Machine, so no
 * `ScenarioNode` exists to drive a story from. `button.md`'s own
 * "Keyboard" note claims Enter/Space both activate it, free from the
 * browser, since the root is a real `<button>`. Proven here in an actual
 * browser (jsdom's `fireEvent.click` doesn't exercise real
 * keyboard-to-click synthesis — the exact gap this story closes).
 */
const meta: Meta<typeof Button> = {
  component: Button,
  title: "Keyboard/Button",
  args: { onPress: fn() },
  render: (args) => <Button {...args}>Press me</Button>,
};
export default meta;
type Story = StoryObj<typeof Button>;

export const EnterActivatesIt: Story = {
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector<HTMLButtonElement>('[data-loom-component="button"]')!;
    root.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const SpaceActivatesIt: Story = {
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector<HTMLButtonElement>('[data-loom-component="button"]')!;
    root.focus();
    await userEvent.keyboard(" ");
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const DisabledDoesNotActivateViaKeyboard: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector<HTMLButtonElement>('[data-loom-component="button"]')!;
    root.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
