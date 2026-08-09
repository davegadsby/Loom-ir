import { extractEmittedNodeIds, joinResults, readLedger, type ReportEntry } from "loom-results";
import { loadComponent } from "../loadComponent.js";
import { emitAllTests } from "../emitAllTests.js";

export interface ReportOptions {
  results: string;
}

/** `loom report <spec> --results loom.results.json` — parse → join → derived status per node (§9). */
export function reportCommand(specPath: string, options: ReportOptions): ReportEntry[] {
  const component = loadComponent(specPath);
  const emittedIds = extractEmittedNodeIds(emitAllTests(component));
  const ledger = readLedger(options.results);
  return joinResults(component, emittedIds, ledger);
}
