import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { emitComponentCss, emitTokensCss } from "loom-emit-styles";
import type { DesignTokens } from "loom-tokens";
import type { EmittedFile } from "loom-ir";
import { loadComponent } from "./loadComponent.js";
import { emitAllTests } from "./emitAllTests.js";

const examplesDir = fileURLToPath(new URL("../../../examples", import.meta.url));
const specsDir = join(examplesDir, "specs");
const generatedDir = join(examplesDir, "generated");
const tokensPath = join(examplesDir, "design-tokens.json");

// Real standalone components only, matching examples/regenerate.ts.
const components = ["checkbox", "disclosure", "button", "dialog", "confirmation-dialog", "login-dialog"];

function assertMatchesCommitted(dir: string, files: readonly EmittedFile[]): void {
  for (const file of files) {
    const committedPath = join(dir, file.path);
    const committed = readFileSync(committedPath, "utf8");
    expect(committed, `${committedPath} is stale relative to a fresh compile — run \`pnpm examples:generate\``).toBe(
      file.contents
    );
  }
}

/**
 * §2's determinism rule ("same spec in, same tree/output out, always") is
 * only a claim until something checks it. This re-runs the exact
 * component/test emission examples/regenerate.ts uses and diffs it against
 * the committed examples/generated/ files — a spec or emitter change without
 * a re-run of `pnpm examples:generate` fails the suite instead of the
 * committed examples silently going stale.
 *
 * Scoped to the deterministic compile/emit outputs, not the CLI-spawned
 * report/validate text captures under examples/generated/reports/, which
 * are illustrative rather than something this test re-derives.
 */
describe("examples/generated is up to date with the compiler", () => {
  for (const name of components) {
    describe(name, () => {
      it("react output matches the committed file", () => {
        const component = loadComponent(join(specsDir, `${name}.md`));
        assertMatchesCommitted(join(generatedDir, "react"), emitReact(component));
      });

      it("angular output matches the committed file", () => {
        const component = loadComponent(join(specsDir, `${name}.md`));
        assertMatchesCommitted(join(generatedDir, "angular"), emitAngular(component));
      });

      it("test output matches the committed files", () => {
        const component = loadComponent(join(specsDir, `${name}.md`));
        assertMatchesCommitted(join(generatedDir, "tests"), emitAllTests(component));
      });

      it("style output matches the committed file, if the component has any Style nodes", () => {
        const component = loadComponent(join(specsDir, `${name}.md`));
        if (component.style.length === 0) return;
        assertMatchesCommitted(join(generatedDir, "styles"), [emitComponentCss(component)]);
      });
    });
  }

  it("tokens.css matches a fresh emit from the committed design-tokens.json", () => {
    const tokens: DesignTokens = JSON.parse(readFileSync(tokensPath, "utf8"));
    assertMatchesCommitted(join(generatedDir, "styles"), [emitTokensCss(tokens)]);
  });

  it("has no orphaned committed file left over from a renamed or removed node", () => {
    const freshPathsBySubdir: Record<"react" | "angular" | "tests" | "styles", Set<string>> = {
      react: new Set(),
      angular: new Set(),
      tests: new Set(),
      styles: new Set(["tokens.css"]),
    };
    for (const name of components) {
      const component = loadComponent(join(specsDir, `${name}.md`));
      for (const f of emitReact(component)) freshPathsBySubdir.react.add(f.path);
      for (const f of emitAngular(component)) freshPathsBySubdir.angular.add(f.path);
      for (const f of emitAllTests(component)) freshPathsBySubdir.tests.add(f.path);
      if (component.style.length > 0) freshPathsBySubdir.styles.add(emitComponentCss(component).path);
    }

    for (const sub of ["react", "angular", "tests", "styles"] as const) {
      const committedFiles = readdirSync(join(generatedDir, sub));
      for (const committed of committedFiles) {
        expect(
          freshPathsBySubdir[sub].has(committed),
          `examples/generated/${sub}/${committed} is committed but no longer produced by a fresh compile`
        ).toBe(true);
      }
    }
  });
});
