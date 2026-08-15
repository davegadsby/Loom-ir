import type { Meta, StoryObj } from "@storybook/angular";
import { RadioGroupComponent } from "../generated/angular/RadioGroup.component";

/**
 * Hand-authored, not generated — static/display-only for this first pass
 * (see `examples/angular-stories/Checkbox.stories.ts` for why). Proves the
 * `each`/shared-selection composite actually renders — in particular that
 * the `*ngFor` over `options` works at all, which it didn't until the
 * missing `NgFor` standalone import this Storybook surfaced was fixed in
 * `packages/loom-emit-angular/src/emitAngular.ts`.
 *
 * `render` is required, not just `component` + `args` — see
 * `examples/angular-stories/Checkbox.stories.ts` for why.
 */
const meta: Meta<RadioGroupComponent> = {
  component: RadioGroupComponent,
  title: "Material/RadioGroup",
  render: (args) => ({ props: args, template: `<loom-radio-group [options]="options"></loom-radio-group>` }),
  args: {
    options: [
      { value: "compact", label: "Compact" },
      { value: "comfortable", label: "Comfortable" },
    ],
  },
};
export default meta;
type Story = StoryObj<RadioGroupComponent>;

export const Default: Story = {};
