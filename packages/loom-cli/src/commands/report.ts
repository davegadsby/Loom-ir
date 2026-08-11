import { extractEmittedNodeIds, joinResults, readLedger, type ReportEntry } from "loom-results";
import { emitStorybookPlay } from "loom-emit-tests";
import { loadComponent } from "../loadComponent.js";
import { emitAllTests } from "../emitAllTests.js";

export interface ReportOptions {
  results: string;
}

/** `loom report <spec> --results loom.results.json` — parse → join → derived status per node (§9). */
export function reportCommand(specPath: string, options: ReportOptions): ReportEntry[] {
  const component = loadComponent(specPath);
  // emitStorybookPlay is deliberately outside emitAllTests's bundle (its output must live
  // next to the compiled component, not a shared tests dir — see emitAllTests.ts), but its
  // scenario claims still need to count toward emission coverage here.
  const emittedIds = extractEmittedNodeIds([...emitAllTests(component), ...emitStorybookPlay(component)]);
  const ledger = readLedger(options.results);
  return joinResults(component, emittedIds, ledger);
}
