import { allNodes, type ComponentNode, type NodeId } from "loom-ir";
import type { ResultsLedger } from "loom-results";

export interface Ratio {
  total: number;
  covered: number;
  /** 1 when `total` is 0 — an empty denominator is vacuously fully covered, not a failure. */
  ratio: number;
}

function makeRatio(total: number, covered: number): Ratio {
  return { total, covered, ratio: total === 0 ? 1 : covered / total };
}

/** Proportion of assertable nodes with a corresponding emitted test (§8/§10). `UnexpressibleNode` is assertable but never emitted, so it drags this down by design. */
export function computeEmissionCoverage(tree: ComponentNode, emittedTestIds: ReadonlySet<NodeId>): Ratio {
  const assertable = allNodes(tree).filter((n) => n.assertable);
  const emitted = assertable.filter((n) => emittedTestIds.has(n.id));
  return makeRatio(assertable.length, emitted.length);
}

/** Proportion of emitted tests with a recorded result (§8/§10). */
export function computeResultCoverage(emittedTestIds: ReadonlySet<NodeId>, ledger: ResultsLedger): Ratio {
  const ids = [...emittedTestIds];
  const withResult = ids.filter((id) => id in ledger);
  return makeRatio(ids.length, withResult.length);
}

/** Proportion of assertable claims that are machine-verifiable vs. `UnexpressibleNode` (§10) — a quality signal and a roadmap for the expression language. */
export function computeExpressibilityRatio(tree: ComponentNode): Ratio {
  const assertable = allNodes(tree).filter((n) => n.assertable);
  const expressible = assertable.filter((n) => n.kind !== "unexpressible");
  return makeRatio(assertable.length, expressible.length);
}
