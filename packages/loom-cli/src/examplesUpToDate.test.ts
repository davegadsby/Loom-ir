import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { emitComponentCss, emitTokensCss } from "loom-emit-styles";
import { emitStorybookPlay } from "loom-emit-tests";
import type { DesignTokens } from "loom-tokens";
import type { EmittedFile } from "loom-ir";
import { loadComponent } from "./loadComponent.js";
import { emitAllTests } from "./emitAllTests.js";

const examplesDir = fileURLToPath(new URL("../../../examples", import.meta.url));
const specsDir = join(examplesDir, "specs");
const generatedDir = join(examplesDir, "generated");
const tokensPath = join(examplesDir, "design-tokens.json");

// Real standalone components only, matching examples/regenerate.ts.
const components = [
  "checkbox",
  "disclosure",
  "button",
  "dialog",
  "confirmation-dialog",
  "login-dialog",
  "signup-dialog",
  "list",
  "list-item",
  "task-list",
  "profile-card",
  "dismiss-banner",
];

// A second, independent example set (§ material-parity plan) — kept
// physically apart from the root set above, sharing this same drift check
// via describeExampleSet below rather than a duplicated one.
const materialSpecsDir = join(examplesDir, "material", "specs");
const materialGeneratedDir = join(examplesDir, "material", "generated");
const materialComponents = ["list", "radio-button", "radio-group", "slide-toggle", "card"];

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
 * the committed examples/generated/ (or examples/material/generated/)
 * files — a spec or emitter change without a re-run of `pnpm
 * examples:generate` fails the suite instead of the committed examples
 * silently going stale.
 *
 * Scoped to the deterministic compile/emit outputs, not the CLI-spawned
 * report/validate text captures under examples/generated/reports/, which
 * are illustrative rather than something this test re-derives — and which
 * only exist for the root set (§ regenerate.ts).
 *
 * `includeStyles` is root-set-only: the material set's specs declare no
 * Style sections yet, so it has no `generated/styles/` directory at all —
 * including it there would `readdirSync` a directory that doesn't exist.
 */
function describeExampleSet(
  label: string,
  setSpecsDir: string,
  setGeneratedDir: string,
  setComponents: readonly string[],
  options: { includeStyles?: boolean } = {}
): void {
  const includeStyles = options.includeStyles ?? false;
  const subdirs = includeStyles ? (["react", "angular", "tests", "styles"] as const) : (["react", "angular", "tests"] as const);

  describe(label, () => {
    for (const name of setComponents) {
      describe(name, () => {
        it("react output matches the committed file", () => {
          const component = loadComponent(join(setSpecsDir, `${name}.md`));
          assertMatchesCommitted(join(setGeneratedDir, "react"), emitReact(component));
        });

        it("storybook story matches the committed file, if the component has any scenario claims", () => {
          const component = loadComponent(join(setSpecsDir, `${name}.md`));
          // Written into generated/react/ (a story imports its component by relative
          // path), not generated/tests/ — see examples/regenerate.ts.
          assertMatchesCommitted(join(setGeneratedDir, "react"), emitStorybookPlay(component));
        });

        it("angular output matches the committed file", () => {
          const component = loadComponent(join(setSpecsDir, `${name}.md`));
          assertMatchesCommitted(join(setGeneratedDir, "angular"), emitAngular(component));
        });

        it("test output matches the committed files", () => {
          const component = loadComponent(join(setSpecsDir, `${name}.md`));
          assertMatchesCommitted(join(setGeneratedDir, "tests"), emitAllTests(component));
        });

        if (includeStyles) {
          it("style output matches the committed file, if the component has any Style nodes", () => {
            const component = loadComponent(join(setSpecsDir, `${name}.md`));
            if (component.style.length === 0) return;
            assertMatchesCommitted(join(setGeneratedDir, "styles"), [emitComponentCss(component)]);
          });
        }
      });
    }

    it("has no orphaned committed file left over from a renamed or removed node", () => {
      const freshPathsBySubdir: Record<(typeof subdirs)[number], Set<string>> = Object.fromEntries(
        subdirs.map((s) => [s, new Set<string>(s === "styles" ? ["tokens.css"] : [])])
      ) as Record<(typeof subdirs)[number], Set<string>>;

      for (const name of setComponents) {
        const component = loadComponent(join(setSpecsDir, `${name}.md`));
        for (const f of emitReact(component)) freshPathsBySubdir.react.add(f.path);
        for (const f of emitStorybookPlay(component)) freshPathsBySubdir.react.add(f.path);
        for (const f of emitAngular(component)) freshPathsBySubdir.angular.add(f.path);
        for (const f of emitAllTests(component)) freshPathsBySubdir.tests.add(f.path);
        if (includeStyles && component.style.length > 0) freshPathsBySubdir.styles!.add(emitComponentCss(component).path);
      }

      for (const sub of subdirs) {
        const committedFiles = readdirSync(join(setGeneratedDir, sub));
        for (const committed of committedFiles) {
          expect(
            freshPathsBySubdir[sub].has(committed),
            `${setGeneratedDir}/${sub}/${committed} is committed but no longer produced by a fresh compile`
          ).toBe(true);
        }
      }
    });
  });
}

describe("examples/generated is up to date with the compiler", () => {
  describeExampleSet("root set", specsDir, generatedDir, components, { includeStyles: true });

  it("tokens.css matches a fresh emit from the committed design-tokens.json", () => {
    const tokens: DesignTokens = JSON.parse(readFileSync(tokensPath, "utf8"));
    assertMatchesCommitted(join(generatedDir, "styles"), [emitTokensCss(tokens)]);
  });
});

describe("examples/material/generated is up to date with the compiler", () => {
  describeExampleSet("material set", materialSpecsDir, materialGeneratedDir, materialComponents);
});
