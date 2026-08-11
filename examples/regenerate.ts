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
 */
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadComponent, writeFiles, emitAllTests } from "loom-cli";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { emitTokensCss, emitComponentCss } from "loom-emit-styles";
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

for (const name of components) {
  const component = loadComponent(join(specsDir, `${name}.md`));

  writeFiles(join(generatedDir, "react"), emitReact(component));
  writeFiles(join(generatedDir, "angular"), emitAngular(component));
  writeFiles(join(generatedDir, "tests"), emitAllTests(component));

  // Only components with Style nodes get a stylesheet — nothing to emit otherwise.
  if (component.style.length > 0) {
    writeFiles(join(generatedDir, "styles"), [emitComponentCss(component)]);
  }
}

writeFiles(join(generatedDir, "styles"), [emitTokensCss(tokens)]);

console.log(`Regenerated examples/generated/{react,angular,tests,styles} for: ${components.join(", ")}`);

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
