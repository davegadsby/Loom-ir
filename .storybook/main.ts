import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Stories live in four places, all outside this file's own directory:
 * generated ones (one per component with a `scenario` claim) are written by
 * `emitStorybookPlay` alongside the compiled component they import, under
 * `examples/generated/react/`; hand-authored ones (composites whose
 * behavior a `ScenarioNode` structurally can't reach) live under
 * `examples/stories/`. `examples/material/` mirrors that same split for the
 * separate Angular Material-replica example set (§ material-parity plan) —
 * kept physically apart from the root set so the two experiments don't mix.
 * None of the four globs descend into `generated/angular` — this backend
 * targets React only (§ Part 2, "Scoped to React only").
 */
const config: StorybookConfig = {
  stories: [
    "../examples/generated/react/*.stories.tsx",
    "../examples/stories/*.stories.tsx",
    "../examples/material/generated/react/*.stories.tsx",
    "../examples/material/stories/*.stories.tsx",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Composition: this Storybook doubles as the combined host for the
  // separate Angular Storybook (.storybook-angular/) — Storybook's `refs`
  // feature, not a third "collator" project. Deployed (Pages): resolves to
  // the merged storybook-static/angular/ subpath deploy-storybook.yml
  // builds. Local dev: resolves to the Angular dev server's own port —
  // running `pnpm storybook` alongside `pnpm storybook:angular` composes
  // them locally too, for free.
  refs: {
    angular: {
      title: "Angular",
      url: process.env.STORYBOOK_BASE_PATH ? `${process.env.STORYBOOK_BASE_PATH}angular/` : "http://localhost:6007",
    },
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
