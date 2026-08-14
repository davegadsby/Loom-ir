import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { Card } from "../generated/react/Card";

/**
 * Hand-authored, not generated — `card` has no Machine and no
 * `ScenarioNode` claims, so `emitStorybookPlay` produces nothing for it.
 * Structured to match `reference-images/card.jpeg` (`card.md`'s own
 * `matches-reference` Style claim): an avatar + title/subtitle row in
 * `header`, body copy in `content`, two text-button actions in `actions`.
 *
 * The avatar is a plain inline SVG circle, not a real photo — this
 * environment has no outbound network access to fetch one. Its color and
 * the title/subtitle text both read the same `--color-*`/`--typography-*`
 * custom properties `tokens.css` already emits for every design token
 * (regardless of whether any component's own Style section references
 * them), so even this consumer-supplied slot content stays traceable to
 * the real token source instead of hardcoded magic numbers.
 */
const AVATAR_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#6750a4"/></svg>`
)}`;

const actionButtonStyle: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-accent-default)",
  fontFamily: "var(--typography-fontFamily)",
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  padding: "8px 12px",
  cursor: "pointer",
};

const meta: Meta<typeof Card> = {
  component: Card,
  title: "Material/Card",
  render: (args) => (
    <Card
      {...args}
      header={
        <>
          <img
            src={AVATAR_PLACEHOLDER}
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "var(--typography-title-size)", fontWeight: "var(--typography-title-weight)" }}>
              Card title
            </div>
            <div style={{ fontSize: "var(--typography-body-size)", color: "var(--color-text-secondary)" }}>
              Dog Breed
            </div>
          </div>
        </>
      }
      content={
        <p style={{ margin: 0, color: "var(--color-text-primary)" }}>
          Some card content, describing whatever this card is about.
        </p>
      }
      actions={
        <>
          <button type="button" style={actionButtonStyle}>
            Like
          </button>
          <button type="button" style={actionButtonStyle}>
            Share
          </button>
        </>
      }
    />
  ),
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};
