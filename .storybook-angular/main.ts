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
 * `AngularLegacyBuildOptionsError`. `../angular.json` registers the project
 * hosting those two builders, plus a `build` target for a minimal bootstrap
 * app (`.storybook-angular/bootstrap/`, never actually mounted at runtime)
 * — needed only because `start-storybook`'s own schema, unlike
 * `build-storybook`'s, has no default for `browserTarget` and throws
 * without one (see `start-schema.json` vs `build-schema.json` in
 * `@storybook/angular`'s package root). `experimentalZoneless` (avoiding a
 * `zone.js` dependency entirely) lives in `angular.json`'s own builder
 * options, not here — it's a builder-schema option, not a `main.ts`
 * framework option, in this codepath.
 *
 * RESOLVED — component rendering: for a long time every generated
 * `.component.ts` file compiled to a genuinely empty webpack module when
 * Storybook's own webpack build tried to AOT/JIT-compile the raw source
 * directly via `@ngtools/webpack` (confirmed emptiness across a headless
 * `angular.json` project, a real bootstrapped `browserTarget` app, and the
 * dev server — ruling out tree-shaking and reachability theories in turn).
 * The actual fix: stories now import components from
 * `packages/loom-angular-components/`, a real Angular library built once
 * via `ng-packagr` (`pnpm build:angular-lib`, wired as a prerequisite step
 * in the `storybook:angular`/`storybook:angular:build` scripts) — the same
 * pattern every real Angular component library uses. Storybook then
 * imports its pre-compiled output as an ordinary dependency; no
 * Angular-specific transform happens inside Storybook's own webpack build
 * anymore, sidestepping `@ngtools/webpack`'s broken per-file emission
 * entirely. `examples/generated/angular/` and
 * `examples/material/generated/angular/` stay the real, drift-tested
 * generator output — the library's `examples/angular-components.public-api.ts`
 * is a thin re-export barrel, not a copy.
 *
 * KNOWN LIMITATION — components render structurally correct (real DOM,
 * real `*ngFor`/selection state, real `_nghost`/`_ngcontent` Ivy markers)
 * but currently unstyled: `preview.ts`'s global `tokens.css` import never
 * makes it into the built page (no CSS file or `<link>` in
 * `storybook-static/iframe.html`), so components' own `styleUrls` CSS —
 * confirmed correctly compiled and injected as real `<style>` tags — falls
 * back on undefined custom properties (`var(--color-surface-default)`
 * resolves empty). A separate, smaller gap from the rendering fix above;
 * open follow-up work.
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
    // Unlike .storybook/main.ts's viteFinal (Vite needs an explicit `base`
    // for its absolute asset URLs), this builder's iframe.html loads chunks
    // via plain relative `import './foo.js'` specifiers — confirmed by
    // inspecting the built output directly. Setting `output.publicPath` to
    // an absolute STORYBOOK_BASE_PATH-derived value breaks this: the
    // builder statically prefixes each injected import with `./`, so an
    // already-absolute publicPath produces a broken doubled path
    // (`.//Loom-ir/angular/Loom-ir/angular/runtime....js`, 404). Natural
    // relative resolution against the page's own served location already
    // does the right thing under any nesting depth (root, `/<repo>/angular/`
    // on Pages, etc.) with no base-path configuration needed at all.

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
