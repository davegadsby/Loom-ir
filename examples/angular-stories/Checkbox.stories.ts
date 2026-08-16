import type { Meta, StoryObj } from "@storybook/angular";
import { CheckboxComponent } from "loom-angular-components";

/**
 * Hand-authored, not generated — static/display-only for this first pass
 * (no play functions/interaction tests yet; React already covers real
 * click/keyboard interaction coverage for `checkbox`, and replicating that
 * for Angular is real, separate future work). Exists to prove the Angular
 * output actually bootstraps and renders in a real browser at all — until
 * this Storybook existed, `checkbox.component.ts` was only ever typechecked
 * as plain TypeScript, never instantiated.
 *
 * `render` is required, not just `component` + `args` — without it,
 * `@storybook/angular`'s automatic args-to-template rendering produced a
 * broken host element (`<checkbox--checked>`, the story id itself, instead
 * of the real `loom-checkbox` selector) in this zoneless/no-`browserTarget`
 * setup, leaving the story blank. An explicit template sidesteps whatever
 * that auto-render path assumes.
 */
const meta: Meta<CheckboxComponent> = {
  component: CheckboxComponent,
  title: "Checkbox",
  render: (args) => ({
    props: args,
    template: `<loom-checkbox [checked]="checked"></loom-checkbox>`,
    moduleMetadata: { imports: [CheckboxComponent] },
  }),
};
export default meta;
type Story = StoryObj<CheckboxComponent>;

export const Unchecked: Story = {
  args: { checked: false },
};

export const Checked: Story = {
  args: { checked: true },
};
