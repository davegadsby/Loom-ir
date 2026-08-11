import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, expect } from "storybook/test";
import { Disclosure } from "../generated/react/Disclosure";

/**
 * Hand-authored, not generated — this is about slot-supplied keyboard
 * operability, not a scenario claim (the generated `Disclosure.stories.tsx`
 * under `generated/react/` already covers the click-driven scenarios).
 * `disclosure.md`'s own "Keyboard" note explains the mechanism this
 * proves: the root has no keydown handler of its own, so keyboard
 * operability depends entirely on the consumer supplying a real,
 * focusable element into the `trigger` slot — a native `click` from that
 * element's own Enter/Space activation bubbles up to the root's `onClick`.
 */
const meta: Meta<typeof Disclosure> = {
  component: Disclosure,
  title: "Keyboard/Disclosure",
  args: {
    trigger: <button type="button">Toggle</button>,
    panel: <div>Panel content</div>,
  },
};
export default meta;
type Story = StoryObj<typeof Disclosure>;

export const SuppliedTriggerButtonIsKeyboardOperable: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-loom-component="disclosure"]')!;
    const trigger = root.querySelector("button")!;

    await expect(root.getAttribute("data-state")).toBe("collapsed");

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(root.getAttribute("data-state")).toBe("expanded");

    trigger.focus();
    await userEvent.keyboard(" ");
    await expect(root.getAttribute("data-state")).toBe("collapsed");
  },
};
