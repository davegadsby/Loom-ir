import type { Meta, StoryObj } from "@storybook/angular";
import { CardComponent } from "../generated/angular/Card.component";

/**
 * Hand-authored, not generated — static/display-only for this first pass
 * (see `examples/angular-stories/Checkbox.stories.ts` for why). Deliberately
 * mirrors `examples/material/stories/Card.stories.tsx` (React)'s content —
 * an avatar + title/subtitle header, body copy, two action buttons — via
 * `slot="..."` attributes, Angular's real content-projection syntax for
 * `<ng-content select="[slot=...]">`.
 *
 * Renders visibly *plainer* than the React version, on purpose: `card.md`'s
 * own Rationale documents that Angular's named slots have no wrapper node
 * of their own to attach a class to, so only `root`'s styling (background,
 * radius, elevation, font-family) applies here — the header/content/actions
 * layout and padding React gets for free are absent. This story's own
 * minimal inline styling on the projected markup is the closest Angular
 * equivalent of what `Card.stories.tsx` gets from `card.md`'s compiled
 * `header-layout`/`header-padding`/etc — consumer-supplied, not compiled.
 */
const AVATAR_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#6750a4"/></svg>`
)}`;

const meta: Meta<CardComponent> = {
  component: CardComponent,
  title: "Material/Card",
};
export default meta;
type Story = StoryObj<CardComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <loom-card>
        <div slot="header" style="display: flex; align-items: center; gap: 8px; padding: 8px;">
          <img src="${AVATAR_PLACEHOLDER}" alt="" width="40" height="40" style="border-radius: 50%; flex-shrink: 0;" />
          <div>
            <div style="font-size: var(--typography-title-size); font-weight: var(--typography-title-weight);">Card title</div>
            <div style="font-size: var(--typography-body-size); color: var(--color-text-secondary);">Dog Breed</div>
          </div>
        </div>
        <p slot="content" style="margin: 0; padding: 8px; font-size: var(--typography-body-size); color: var(--color-text-primary);">
          Some card content, describing whatever this card is about.
        </p>
        <div slot="actions" style="display: flex; gap: 4px; padding: 4px;">
          <button type="button" style="border: none; background: none; color: var(--color-accent-default); font-family: var(--typography-fontFamily); font-size: 13px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; padding: 8px 12px; cursor: pointer;">Like</button>
          <button type="button" style="border: none; background: none; color: var(--color-accent-default); font-family: var(--typography-fontFamily); font-size: 13px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; padding: 8px 12px; cursor: pointer;">Share</button>
        </div>
      </loom-card>
    `,
  }),
};
