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
 */
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadComponent, writeFiles, emitAllTests } from "loom-cli";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";

const here = dirname(fileURLToPath(import.meta.url));
const specsDir = join(here, "specs");
const generatedDir = join(here, "generated");
const resultsLedger = join(here, "loom.results.json");
const repoRoot = join(here, "..");
const cliBin = join(repoRoot, "packages", "loom-cli", "dist", "bin.js");

// Real standalone components only — interactive-base is a mixin spec, not
// something anyone compiles to a component on its own.
const components = ["checkbox", "disclosure"];

for (const name of components) {
  const component = loadComponent(join(specsDir, `${name}.md`));

  writeFiles(join(generatedDir, "react"), emitReact(component));
  writeFiles(join(generatedDir, "angular"), emitAngular(component));
  writeFiles(join(generatedDir, "tests"), emitAllTests(component));
}

console.log(`Regenerated examples/generated/{react,angular,tests} for: ${components.join(", ")}`);

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

console.log(`Regenerated examples/generated/reports for: ${components.join(", ")}`);
