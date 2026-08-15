import type { StorybookConfig } from "@storybook/angular";

/**
 * The Angular-emitter counterpart to `.storybook/main.ts` (React) — same
 * split (generated stories next to the components they import, hand-authored
 * ones in a sibling `angular-stories/` directory), a distinct port so both
 * can run side by side locally.
 *
 * Unlike React, this can't run through the plain `storybook dev`/`storybook
 * build` CLI: `@storybook/angular`'s webpack preset (`framework-preset-angular-cli.js`,
 * `checkForLegacyBuildOptions`) unconditionally throws unless invoked
 * through one of its own Angular CLI Architect builders
 * (`@storybook/angular:start-storybook`/`build-storybook`), confirmed
 * directly from its shipped source after the plain-CLI path failed with
 * `AngularLegacyBuildOptionsError`. `../angular.json` registers a project
 * purely to host those two builders (no real Angular app — `browserTarget`
 * is optional and unset) — this file is still where the actual Storybook
 * config (stories, webpack customization) lives; `ng run
 * loom-storybook:storybook`/`:build-storybook` (the `storybook:angular`/
 * `storybook:angular:build` root scripts) is what actually invokes it.
 * `experimentalZoneless` (avoiding a `zone.js` dependency entirely) lives in
 * `angular.json`'s own builder options, not here — it's a builder-schema
 * option, not a `main.ts` framework option, in this codepath.
 *
 * KNOWN LIMITATION — build/typecheck only, does not yet visually render:
 * every generated `.component.ts` file (with or without a real
 * `browserTarget`/bootstrapped app registered in `angular.json` — both were
 * tried) compiles to a genuinely empty webpack module under
 * `@ngtools/webpack` in this configuration; no build error or TypeScript
 * diagnostic surfaces it. Confirmed by inspecting compiled bundle text
 * directly (the component class body is entirely absent, not just
 * minified/hidden) and by inspecting the live DOM (component selectors
 * render as empty, unrecognized custom elements). This build still has real
 * value — it typechecks and bundles the real generated output, and already
 * caught one genuine compiler bug (`loom-emit-angular` wasn't importing
 * `NgFor` for `*ngFor` usage) that nothing else in this repo could catch,
 * since `tsc` has no notion of Angular template-level directive imports.
 * Actually viewing rendered Angular components remains open follow-up work.
 * See `README.md`'s Storybook section for the user-facing version of this.
 */
const config: StorybookConfig = {
  stories: [
    "../examples/generated/angular/*.stories.ts",
    "../examples/angular-stories/*.stories.ts",
    "../examples/material/generated/angular/*.stories.ts",
    "../examples/material/angular-stories/*.stories.ts",
  ],
  framework: {
    name: "@storybook/angular",
    options: {},
  },
  webpackFinal: async (webpackConfig) => {
    // Mirrors .storybook/main.ts's own viteFinal base-path hook — a GitHub
    // Pages project site is served under /<repo>/, and this Storybook is
    // nested one level further, under /<repo>/angular/ (see
    // .github/workflows/deploy-storybook.yml). Gated on the same env var so
    // local dev (storybook:angular) and any local build without it are
    // unaffected.
    if (process.env.STORYBOOK_BASE_PATH) {
      webpackConfig.output = {
        ...webpackConfig.output,
        publicPath: `${process.env.STORYBOOK_BASE_PATH}angular/`,
      };
    }

    // Two of the Angular CLI preset's own module rules match every .ts file
    // with no exclusion for story files, found via `ng run
    // loom-storybook:build-storybook --debug-webpack` after *.stories.ts
    // files first compiled to empty modules (no exports — @ngtools/webpack's
    // AOT program only emits code reachable from a real entry point, and
    // story files are loaded via Storybook's own CSF loader/require
    // mechanism, invisible to that reachability analysis), then, once
    // @ngtools/webpack was excluded, failed with a SyntaxError from
    // @angular-devkit/build-angular's own babel webpack-loader (configured
    // for plain JS, not TypeScript — chokes on `import type {...}`). Neither
    // loader is needed for story files at all (no Angular templates, and
    // Storybook's own CSF loader — the `test: /\.stories\....$/` rule
    // already present below these — already knows how to parse them) so
    // route them around both.
    const matchesLoader = (value: unknown): boolean =>
      typeof value === "string" && (value.includes("@ngtools/webpack") || value.includes("babel/webpack-loader"));
    for (const rule of webpackConfig.module?.rules ?? []) {
      if (!rule || typeof rule !== "object") continue;
      const use = (rule as { use?: unknown }).use;
      const usesMatchingLoader =
        matchesLoader((rule as { loader?: unknown }).loader) ||
        (Array.isArray(use) && use.some((u) => matchesLoader(typeof u === "string" ? u : (u as { loader?: unknown })?.loader)));
      if (!usesMatchingLoader) continue;
      const mutableRule = rule as { exclude?: unknown };
      const existingExclude = mutableRule.exclude;
      const excludeList = Array.isArray(existingExclude) ? existingExclude : existingExclude ? [existingExclude] : [];
      mutableRule.exclude = [...excludeList, /\.stories\.ts$/];
    }

    // Story files still need *something* to strip their TypeScript syntax
    // before Storybook's own CSF loader (which expects plain JS input) sees
    // them — neither excluded loader above could do it (one empties the
    // file, the other can't parse TS at all), and nothing else in this
    // Angular-CLI-derived config handles a bare .ts file generically the way
    // `@storybook/react-vite`'s own Vite pipeline does. `swc-loader` is a
    // small, already-satisfied addition (`@swc/core` is already a real
    // dependency of `@storybook/builder-webpack5` itself).
    webpackConfig.module?.rules?.unshift({
      test: /\.stories\.ts$/,
      loader: "swc-loader",
      options: {
        jsc: { parser: { syntax: "typescript", tsx: false }, target: "es2022" },
        module: { type: "es6" },
      },
    });

    return webpackConfig;
  },
};

export default config;
