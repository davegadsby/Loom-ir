import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Stories live in two places, both outside this file's own directory:
 * generated ones (one per component with a `scenario` claim) are written by
 * `emitStorybookPlay` alongside the compiled component they import, under
 * `examples/generated/react/`; hand-authored ones (composites whose
 * behavior a `ScenarioNode` structurally can't reach) live under
 * `examples/stories/`. Neither glob descends into `examples/generated/angular` —
 * this backend targets React only (§ Part 2, "Scoped to React only").
 */
const config: StorybookConfig = {
  stories: ["../examples/generated/react/*.stories.tsx", "../examples/stories/*.stories.tsx"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // A GitHub Pages project site is served under /<repo>/, not /, so asset
  // URLs baked in at build time need a matching base. Gated on the env var
  // so the local dev server and `storybook:test:ci` (served at the root of
  // localhost:6006) are unaffected — neither sets it.
  viteFinal: async (viteConfig) => {
    if (process.env.STORYBOOK_BASE_PATH) {
      viteConfig.base = process.env.STORYBOOK_BASE_PATH;
    }
    return viteConfig;
  },
};

export default config;
