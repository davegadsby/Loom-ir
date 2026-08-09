import type { DesignTokens } from "./types.js";

export function makeTokensFixture(): DesignTokens {
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
