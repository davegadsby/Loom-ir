import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, expect, fn } from "storybook/test";
import { RadioGroup } from "../generated/react/RadioGroup";

/**
 * Hand-authored, not generated — `radio-group` has no Machine of its own
 * (its shared-selection behavior is expressed entirely through a
 * `SelectionNode` + `each.selects` wiring, neither of which a
 * `ScenarioNode` — which only walks `states`/`transitions` — can reach),
 * so `emitStorybookPlay` produces nothing for it. `radio-group.md`'s own
 * `exactly-one-option-is-ever-selected` claim explains precisely why and
 * points here: the claim language has no way to quantify over rendered
 * `each`-instances, so this is proven in a real browser instead.
 */
const meta: Meta<typeof RadioGroup> = {
  component: RadioGroup,
  title: "Material/RadioGroup",
  args: {
    options: [
      { value: "compact", label: "Compact" },
      { value: "comfortable", label: "Comfortable" },
    ],
    onOptionSelected: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const ClickingOneOptionDeselectsTheOther: Story = {
  play: async ({ canvasElement, args }) => {
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    const compact = radios[0]!;
    const comfortable = radios[1]!;

    // "compact" is radio-group.md's own declared initialValue — starts selected.
    await expect(compact.getAttribute("aria-checked")).toBe("true");
    await expect(comfortable.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(comfortable);

    await expect(comfortable.getAttribute("aria-checked")).toBe("true");
    // The real proof this mechanism works — not just that clicking B selects B,
    // but that the *previously selected* A deselects itself for free, because
    // both options compare against the exact same shared `selected` cell.
    await expect(compact.getAttribute("aria-checked")).toBe("false");

    await expect(args.onOptionSelected).toHaveBeenCalledWith({ value: "comfortable", label: "Comfortable" });
  },
};
