import { computeNodeId } from "loom-ir";
import type { ComponentNode } from "loom-ir";
import type { DesignTokens } from "loom-tokens";

/** Matches loom-tokens' own fixture values, kept local rather than reaching into another package's internal fixtures.ts. */
export function makeStyleTokensFixture(): DesignTokens {
  return {
    color: {
      surface: {
        default: { $value: "#F5F5F5", $type: "color" },
        disabled: { $value: "#E0E0E0", $type: "color" },
      },
    },
    spacing: {
      sm: { $value: "4px", $type: "dimension" },
      md: { $value: "8px", $type: "dimension" },
    },
  };
}

/**
 * A minimal checkbox-shaped component with a `label` slot and three Style
 * nodes: a token-ref on root background, a layout-intent on root (row, gap
 * from `spacing.sm`), and a token-ref on the `label` slot's color — enough
 * to exercise both `part` cases (`"root"` and a named slot) and both style
 * node kinds.
 */
export function makeStyledCheckboxFixture(): ComponentNode {
  return {
    id: "checkbox",
    kind: "component",
    origin: "own",
    assertable: false,
    name: "checkbox",
    extends: [],
    declarations: [
      {
        id: computeNodeId("checkbox", "declarations", "label"),
        kind: "slot",
        origin: "own",
        assertable: false,
        name: "label",
      },
    ],
    states: [],
    transitions: [],
    guards: [],
    rules: [],
    claims: [],
    a11y: [],
    style: [
      {
        id: computeNodeId("checkbox", "style", "root-background"),
        kind: "token-ref",
        origin: "own",
        assertable: true,
        part: "root",
        property: "background-color",
        token: "color.surface.default",
      },
      {
        id: computeNodeId("checkbox", "style", "root-layout"),
        kind: "layout-intent",
        origin: "own",
        assertable: true,
        part: "root",
        display: "flex",
        direction: "row",
        align: "center",
        gapToken: "spacing.sm",
      },
      {
        id: computeNodeId("checkbox", "style", "label-color"),
        kind: "token-ref",
        origin: "own",
        assertable: true,
        part: "label",
        property: "color",
        token: "color.surface.disabled",
      },
    ],
    prose: [],
  };
}
