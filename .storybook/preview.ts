import type { Preview } from "@storybook/react-vite";
// Root design-token custom properties (--color-surface-default, --spacing-sm,
// ...) — every styled component's own CSS references these via var(...) with
// no fallback, so without this global import they silently resolve to
// nothing and the component renders unstyled.
import "../examples/generated/styles/tokens.css";

const preview: Preview = {};

export default preview;
