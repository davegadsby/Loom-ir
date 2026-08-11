import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Generated components `import "./X.css"`. Vite resolves that for real, so
      // rendering them needs a stub — stylesheets are a bundler concern and are
      // not what these tests exercise. Whether those paths point at real files is
      // checked directly by examples/tests/cssImportsResolve.test.ts.
      {
        find: /^.*\.css$/,
        replacement: fileURLToPath(new URL("./examples/tests/cssStub.ts", import.meta.url)),
      },
    ],
  },
  test: {
    // examples/tests/** render the *committed generated components* to prove they
    // actually work — examplesUpToDate.test.ts only proves their text is unchanged.
    include: ["packages/*/src/**/*.test.ts", "examples/tests/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
