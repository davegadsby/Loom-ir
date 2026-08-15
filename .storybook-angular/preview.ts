import type { Preview } from "@storybook/angular";
// Same global design-token import .storybook/preview.ts (React) already
// uses — every styled component's own CSS references these custom
// properties via var(...) with no fallback.
import "../examples/generated/styles/tokens.css";

const preview: Preview = {};

export default preview;
