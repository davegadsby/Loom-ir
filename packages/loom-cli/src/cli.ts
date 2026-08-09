import { Command } from "commander";
import { compileCommand } from "./commands/compile.js";
import { validateCommand } from "./commands/validate.js";
import { reportCommand } from "./commands/report.js";
import { authorCommand } from "./commands/author.js";

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
    .action(
      (
        spec: string,
        opts: {
          results?: string;
          emissionThreshold?: number;
          resultThreshold?: number;
          expressibilityThreshold?: number;
        }
      ) => {
        const outcome = validateCommand(spec, {
          results: opts.results,
          emissionThreshold: opts.emissionThreshold,
          resultThreshold: opts.resultThreshold,
          expressibilityThreshold: opts.expressibilityThreshold,
        });
        console.log(`emission coverage:    ${pct(outcome.emission.ratio)} (${outcome.emission.covered}/${outcome.emission.total})`);
        console.log(`result coverage:      ${pct(outcome.result.ratio)} (${outcome.result.covered}/${outcome.result.total})`);
        console.log(
          `expressibility ratio: ${pct(outcome.expressibility.ratio)} (${outcome.expressibility.covered}/${outcome.expressibility.total})`
        );
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

  return program;
}
