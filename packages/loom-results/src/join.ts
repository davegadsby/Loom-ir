import { allNodes, type ComponentNode, type EmittedFile, type NodeId } from "loom-ir";
import type { ResultsLedger } from "./ledger.js";
import { deriveStatus, type DerivedStatus } from "./status.js";

export interface ReportEntry {
  id: NodeId;
  kind: string;
  status: DerivedStatus;
}

/** `[component/section/slug]` — the bracketed node-id convention every loom-emit-tests backend embeds in its output. */
const NODE_ID_PATTERN = /\[([a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+)\]/g;

/**
 * Recovers which node ids actually got a test emitted by scanning emitted
 * file contents for the `[nodeId]` convention, rather than importing an
 * emitter package directly — loom-results stays decoupled from any specific
 * backend's implementation (§2's layering).
 */
export function extractEmittedNodeIds(files: readonly EmittedFile[]): ReadonlySet<NodeId> {
  const ids = new Set<NodeId>();
  for (const file of files) {
    for (const match of file.contents.matchAll(NODE_ID_PATTERN)) {
      ids.add(match[1]!);
    }
  }
  return ids;
}

/**
 * Joins the results ledger onto the tree at report time (§2/§9), returning a
 * new structure rather than annotating the IR — results never live in the
 * AST.
 */
export function joinResults(
  tree: ComponentNode,
  emittedTestIds: ReadonlySet<NodeId>,
  ledger: ResultsLedger
): ReportEntry[] {
  return allNodes(tree).map((node) => ({
    id: node.id,
    kind: node.kind,
    status: deriveStatus(node, emittedTestIds, ledger),
  }));
}
