import type { Preview } from "@storybook/angular";

// Unlike .storybook/preview.ts (React/Vite, which handles a plain CSS
// import natively), this builder's assembled webpack config only processes
// a .css file if it carries a resourceQuery tag (?ngGlobalStyle or
// ?ngResource) — a bare `import "*.css"` here would silently resolve to
// zero loaders and get dropped. The global design-token stylesheet every
// styled component's own CSS references via var(...) is registered instead
// via ../angular.json's `styles` builder option (the real Angular CLI
// global-styles mechanism, which does add that tag).

const preview: Preview = {};

export default preview;
