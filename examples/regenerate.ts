#!/usr/bin/env -S npx tsx
/**
 * Regenerates the committed output under examples/generated/ from the
 * example specs under examples/specs/. This is the concrete demonstration
 * of the architecture's core promise (§2): same spec in, same tree and code
 * out, always — run this after any spec or emitter change and the diff
 * should be exactly the intended one, never spurious drift.
 *
 * Run via `pnpm examples:generate`. `loom-cli/src/examplesUpToDate.test.ts`
 * re-runs the same compile calls into a tmp dir and fails the suite if the
 * committed files and a fresh run ever disagree.
 *
 * examples/figma-variables-fixture.json stands in for a real Figma Variables
 * REST API response (`GET /v1/files/:file_key/variables/local`) — this
 * sandbox has no live Figma access, so it's hand-authored in that exact
 * shape rather than fetched. `examples/design-tokens.json` and
 * `examples/figma.lock.json` are this script's *output*: the tool-agnostic
 * DTCG tokens and lock the rest of the pipeline (checkbox.md's Style
 * section, loom-emit-styles) actually consumes. `now` is fixed so the lock's
 * `importedAt` stays deterministic — required for the byte-for-byte drift
 * check the same way every other generated file already is.
 *
 * `examples/material/` is a second, independent example set (Angular
 * Material-replica specs, kept deliberately separate from the root set so
 * the two experiments don't mix) — it shares this same
 * compile/emit/write-files logic via `regenerateComponentSet` below,
 * including per-component Style/CSS emission, but skips the
 * figma/tokens/reports steps entirely (it reuses the root set's own
 * committed `tokens.css` custom properties rather than importing its own).
 */
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadComponent, writeFiles, emitAllTests } from "loom-cli";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { emitTokensCss, emitComponentCss } from "loom-emit-styles";
import { emitStorybookPlay } from "loom-emit-tests";
import { importFigmaVariables, type FigmaVariablesResponse } from "loom-tokens-import-figma";

const here = dirname(fileURLToPath(import.meta.url));
const specsDir = join(here, "specs");
const generatedDir = join(here, "generated");
const resultsLedger = join(here, "loom.results.json");
const repoRoot = join(here, "..");
const cliBin = join(repoRoot, "packages", "loom-cli", "dist", "bin.js");

// Real standalone components only — interactive-base is a mixin spec, not
// something anyone compiles to a component on its own.
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

const figmaResponse: FigmaVariablesResponse = JSON.parse(
  readFileSync(join(here, "figma-variables-fixture.json"), "utf8")
);
const { tokens, lock } = importFigmaVariables(figmaResponse, {
  sourceRef: "examples/figma-variables-fixture.json",
  now: () => new Date("2026-01-01T00:00:00Z"),
});
writeFileSync(join(here, "design-tokens.json"), JSON.stringify(tokens, null, 2) + "\n", "utf8");
writeFileSync(join(here, "figma.lock.json"), JSON.stringify(lock, null, 2) + "\n", "utf8");

console.log(`Regenerated examples/{design-tokens.json,figma.lock.json} from examples/figma-variables-fixture.json`);

/**
 * Compiles each named spec under `setSpecsDir` and writes its React/Angular/
 * test/story output under `setGeneratedDir` — the shared core of both
 * example sets. Style/CSS emission and the CLI-captured report/validate
 * text stay outside this function since they're root-set-only concerns
 * (see this file's own doc comment).
 */
function regenerateComponentSet(setSpecsDir: string, setGeneratedDir: string, setComponents: readonly string[]): void {
  for (const name of setComponents) {
    const component = loadComponent(join(setSpecsDir, `${name}.md`));

    writeFiles(join(setGeneratedDir, "react"), emitReact(component));
    writeFiles(join(setGeneratedDir, "angular"), emitAngular(component));
    writeFiles(join(setGeneratedDir, "tests"), emitAllTests(component));
    // Storybook stories import the compiled component by relative path, so they
    // must live alongside it, not in the generic tests output directory above.
    writeFiles(join(setGeneratedDir, "react"), emitStorybookPlay(component));

    // Only components with Style nodes get a stylesheet — nothing to emit otherwise.
    if (component.style.length > 0) {
      writeFiles(join(setGeneratedDir, "styles"), [emitComponentCss(component)]);
    }
  }
}

regenerateComponentSet(specsDir, generatedDir, components);
writeFiles(join(generatedDir, "styles"), [emitTokensCss(tokens)]);

console.log(`Regenerated examples/generated/{react,angular,tests,styles} for: ${components.join(", ")}`);

const materialSpecsDir = join(here, "material", "specs");
const materialGeneratedDir = join(here, "material", "generated");
// Real standalone components only — interactive-base is a shared mixin spec
// duplicated into this set for self-containment
// (§ examples/material/specs/interactive-base.md), not something anyone
// compiles as its own top-level example. `list` IS compiled here too (same
// as the root set does for its own `list`/`list-item`) even though it's
// also `radio-group`'s own composed dependency — a `uses` reference doesn't
// emit its referenced component's files on its own.
const materialComponents = ["list", "radio-button", "radio-group", "slide-toggle", "card"];
regenerateComponentSet(materialSpecsDir, materialGeneratedDir, materialComponents);

console.log(`Regenerated examples/material/generated/{react,angular,tests} for: ${materialComponents.join(", ")}`);

// Captures the *actual* CLI output (spawned against the built bin, not a
// hand-duplicated formatter) so these files can never silently drift from
// what `loom report`/`loom validate` really print.
function runCli(args: string[]): string {
  const result = spawnSync(process.execPath, [cliBin, ...args], { encoding: "utf8" });
  if (result.error) throw result.error;
  // Absolute paths make the run reliable regardless of cwd; the displayed
  // command line uses repo-relative paths so the captured file reads cleanly.
  const displayArgs = args.map((a) => (a.startsWith("/") ? relative(repoRoot, a) : a));
  return `$ loom ${displayArgs.join(" ")}\n\n${result.stdout}${result.stderr}`;
}

const reportsDir = join(generatedDir, "reports");
mkdirSync(reportsDir, { recursive: true });

for (const name of components) {
  const specPath = join(specsDir, `${name}.md`);
  writeFileSync(join(reportsDir, `${name}.report.txt`), runCli(["report", specPath, "--results", resultsLedger]), "utf8");
  writeFileSync(join(reportsDir, `${name}.validate.txt`), runCli(["validate", specPath, "--results", resultsLedger]), "utf8");
}

// checkbox is enough to demonstrate `--tokens`/`--lock` — not repeated for
// every styled component.
writeFileSync(
  join(reportsDir, "checkbox.validate-tokens.txt"),
  runCli([
    "validate",
    join(specsDir, "checkbox.md"),
    "--results",
    resultsLedger,
    "--tokens",
    join(here, "design-tokens.json"),
    "--lock",
    join(here, "figma.lock.json"),
  ]),
  "utf8"
);

console.log(`Regenerated examples/generated/reports for: ${components.join(", ")}, checkbox.validate-tokens`);
