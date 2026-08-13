import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { RadioButton } from "../generated/react/RadioButton";

/**
 * Hand-authored, not generated — `radio-button` has no Machine, so no
 * `ScenarioNode` exists to drive a story from. Proves the primitive is
 * legible on its own, standalone, outside a `radio-group` — in particular
 * that `label` now renders as real, visible text content (the gap
 * `PropNode.content` closes; see `AGENTS.md`), not just threaded through
 * as inert data the way it silently was before.
 */
const meta: Meta<typeof RadioButton> = {
  component: RadioButton,
  title: "Material/RadioButton",
  args: { value: "compact", label: "Compact", onPress: fn() },
};
export default meta;
type Story = StoryObj<typeof RadioButton>;

export const Unchecked: Story = {
  args: { checked: false },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-loom-component="radio-button"]')!;
    await expect(root.getAttribute("aria-checked")).toBe("false");
    await expect(root.textContent).toBe("Compact");
  },
};

export const Checked: Story = {
  args: { checked: true },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-loom-component="radio-button"]')!;
    await expect(root.getAttribute("aria-checked")).toBe("true");
    await expect(root.textContent).toBe("Compact");
  },
};
