import type { LoomNode, NodeId } from "loom-ir";
import type { ResultsLedger } from "./ledger.js";

/** The §9 status table, plus `not-applicable` for nodes that aren't claims at all (declarations, machine, prose). */
export type DerivedStatus = "confirmed" | "known-gap" | "unverified" | "unknown" | "unverifiable" | "not-applicable";

/**
 * Computes status by joining the results ledger onto a node (§9) — status is
 * never authored, only derived. `unverifiable` is `UnexpressibleNode`'s
 * fixed status regardless of ledger contents: it never has a test to run.
 */
export function deriveStatus(node: LoomNode, emittedTestIds: ReadonlySet<NodeId>, ledger: ResultsLedger): DerivedStatus {
  if (!node.assertable) return "not-applicable";
  if (node.kind === "unexpressible") return "unverifiable";

  if (!emittedTestIds.has(node.id)) return "unknown";

  const result = ledger[node.id];
  if (!result) return "unverified";
  return result.status === "passed" ? "confirmed" : "known-gap";
}
