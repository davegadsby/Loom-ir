import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../generated/react/Card";

/**
 * Hand-authored, not generated — `card` has no Machine and no
 * `ScenarioNode` claims, so `emitStorybookPlay` produces nothing for it.
 * `card.md`'s own `reads-as-one-visually-distinct-surface` claim is
 * `unexpressible`; this story is what actually makes that claim
 * inspectable at all, by supplying real `header`/`content`/`actions`
 * children so the slot-based layout is visible instead of three empty
 * `<div>`s.
 */
const meta: Meta<typeof Card> = {
  component: Card,
  title: "Material/Card",
  render: (args) => (
    <Card
      {...args}
      header={<h3 style={{ margin: 0 }}>Card title</h3>}
      content={<p style={{ margin: 0 }}>Some card content, describing whatever this card is about.</p>}
      actions={<button type="button">Action</button>}
    />
  ),
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};
