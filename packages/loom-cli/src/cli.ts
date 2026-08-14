import { Command } from "commander";
import { compileCommand } from "./commands/compile.js";
import { validateCommand } from "./commands/validate.js";
import { reportCommand } from "./commands/report.js";
import { authorCommand } from "./commands/author.js";
import { tokensImportCommand } from "./commands/tokensImport.js";

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function buildProgram(): Command {
  const program = new Command();
  program.name("loom").description("Loom IR compiler CLI: author, compile, validate, report.");

  program
    .command("compile <spec>")
    .description("Compile a spec to component + test code")
    .requiredOption("--target <target>", "react or angular")
    .option("--out <dir>", "output directory", "loom-out")
    .action((spec: string, opts: { target: string; out: string }) => {
      if (opts.target !== "react" && opts.target !== "angular") {
        console.error(`--target must be 'react' or 'angular', got '${opts.target}'`);
        process.exitCode = 1;
        return;
      }
      const files = compileCommand(spec, { target: opts.target, out: opts.out });
      console.log(`wrote ${files.length} file(s) to ${opts.out}/`);
      for (const file of files) console.log(`  ${file.path}`);
    });

  program
    .command("validate <spec>")
    .description("Compute coverage ratios and gate on thresholds")
    .option("--results <path>", "results ledger path (loom.results.json)")
    .option("--emission-threshold <n>", "minimum emission coverage ratio", parseFloat)
    .option("--result-threshold <n>", "minimum result coverage ratio", parseFloat)
    .option("--expressibility-threshold <n>", "minimum expressibility ratio", parseFloat)
    .option("--tokens <path>", "DTCG tokens JSON — checks every token-ref/gapToken resolves")
    .option("--lock <path>", "tokens lock JSON — checks it isn't stale against --tokens (requires --tokens)")
    .action(
      (
        spec: string,
        opts: {
          results?: string;
          emissionThreshold?: number;
          resultThreshold?: number;
          expressibilityThreshold?: number;
          tokens?: string;
          lock?: string;
        }
      ) => {
        const outcome = validateCommand(spec, {
          results: opts.results,
          emissionThreshold: opts.emissionThreshold,
          resultThreshold: opts.resultThreshold,
          expressibilityThreshold: opts.expressibilityThreshold,
          tokens: opts.tokens,
          lock: opts.lock,
        });
        console.log(`emission coverage:    ${pct(outcome.emission.ratio)} (${outcome.emission.covered}/${outcome.emission.total})`);
        console.log(`result coverage:      ${pct(outcome.result.ratio)} (${outcome.result.covered}/${outcome.result.total})`);
        console.log(
          `expressibility ratio: ${pct(outcome.expressibility.ratio)} (${outcome.expressibility.covered}/${outcome.expressibility.total})`
        );
        if (outcome.tokensResolve) {
          console.log(
            `tokens resolve:       ${outcome.tokensResolve.ok ? "ok" : "FAIL"} (${outcome.tokensResolve.issues.length} issue(s))`
          );
          for (const issue of outcome.tokensResolve.issues) {
            console.error(`FAIL: token '${issue.token}' referenced by '${issue.nodeId}' does not resolve`);
          }
          if (!outcome.tokensResolve.ok) process.exitCode = 1;
        }
        if (outcome.lockStaleness) {
          console.log(`tokens lock:          ${outcome.lockStaleness.stale ? "STALE" : "fresh"}`);
          if (outcome.lockStaleness.stale) {
            console.error(
              `FAIL: tokens lock is stale (locked ${outcome.lockStaleness.lockedHash}, current ${outcome.lockStaleness.currentHash})`
            );
            process.exitCode = 1;
          }
        }
        if (outcome.visualReferences) {
          console.log(
            `visual references:    ${outcome.visualReferences.ok ? "ok" : "FAIL"} (${outcome.visualReferences.issues.length} issue(s))`
          );
          for (const issue of outcome.visualReferences.issues) {
            console.error(`FAIL: visual reference '${issue.path}' referenced by '${issue.nodeId}' does not exist`);
          }
          if (!outcome.visualReferences.ok) process.exitCode = 1;
        }
        if (!outcome.gate.passed) {
          for (const failure of outcome.gate.failures) console.error(`FAIL: ${failure}`);
          process.exitCode = 1;
        }
      }
    );

  program
    .command("report <spec>")
    .description("Report derived status per node, joined from a results ledger")
    .requiredOption("--results <path>", "results ledger path (loom.results.json)")
    .action((spec: string, opts: { results: string }) => {
      const report = reportCommand(spec, { results: opts.results });
      for (const entry of report) {
        console.log(`${entry.status.padEnd(14)} ${entry.kind.padEnd(20)} ${entry.id}`);
      }
    });

  program
    .command("author <name>")
    .description("Scaffold a new spec file (no model calls — authoring is upstream of this pipeline)")
    .option("--out <dir>", "output directory", ".")
    .action((name: string, opts: { out: string }) => {
      const path = authorCommand(name, { out: opts.out });
      console.log(`wrote ${path}`);
    });

  const tokens = program.command("tokens").description("Design-token import commands");

  tokens
    .command("import")
    .description("Import a design tool's export into the tool-agnostic DTCG tokens format")
    .requiredOption("--tool <tool>", "design tool the export came from (currently: figma)")
    .requiredOption("--in <path>", "path to the tool's export JSON")
    .requiredOption("--out <path>", "path to write the DTCG tokens JSON")
    .option("--lock-out <path>", "path to write the tokens lock JSON (defaults to <out> with .lock.json)")
    .option("--source-ref <ref>", "identifies the source design file on the lock (defaults to --in)")
    .action((opts: { tool: string; in: string; out: string; lockOut?: string; sourceRef?: string }) => {
      const result = tokensImportCommand({
        tool: opts.tool,
        in: opts.in,
        out: opts.out,
        lockOut: opts.lockOut,
        sourceRef: opts.sourceRef,
      });
      console.log(`wrote ${result.tokensPath}`);
      console.log(`wrote ${result.lockPath}`);
    });

  return program;
}
