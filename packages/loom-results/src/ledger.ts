import { readFileSync, writeFileSync } from "node:fs";
import type { NodeId } from "loom-ir";

export interface ResultEntry {
  status: "passed" | "failed";
  runAt: string;
  durationMs?: number;
  message?: string;
}

/** The results ledger (§2/§9) — observed CI outcomes, keyed by node id. Lives outside the AST, joined at report time. */
export type ResultsLedger = Readonly<Record<NodeId, ResultEntry>>;

export function readLedger(path: string): ResultsLedger {
  return JSON.parse(readFileSync(path, "utf8")) as ResultsLedger;
}

export function writeLedger(path: string, ledger: ResultsLedger): void {
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}
