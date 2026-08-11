import { allNodes, type ComponentNode, type EmittedFile, type NodeId } from "loom-ir";
import type { ResultsLedger } from "./ledger.js";
import { deriveStatus, type DerivedStatus } from "./status.js";

export interface ReportEntry {
  id: NodeId;
  kind: string;
  status: DerivedStatus;
}

/** `[component/section/slug]` — the bracketed node-id convention every loom-emit-tests backend embeds in its output. */
const STRICT_NODE_ID_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/;

/**
 * Broader than `STRICT_NODE_ID_PATTERN`: anything bracketed, slash-separated,
 * and built only from the characters a node id is allowed to use — matches
 * a well-formed 3-segment id *and* a malformed one (2 segments, 4 segments,
 * …), but never an unrelated bracketed JSON fragment (a `[...]` array
 * literal embedded in generated test contents, say), since those contain
 * characters (`"`, `{`, `:`, `,`) outside this charset.
 */
const ID_SHAPED_BRACKET_PATTERN = /\[([a-z0-9-]+(?:\/[a-z0-9-]+)+)\]/g;

/**
 * Recovers which node ids actually got a test emitted by scanning emitted
 * file contents for the `[nodeId]` convention, rather than importing an
 * emitter package directly — loom-results stays decoupled from any specific
 * backend's implementation (§2's layering).
 *
 * Throws on a bracketed, id-shaped string that isn't exactly three
 * kebab-case segments, rather than silently failing to match it: a
 * malformed id would otherwise never be counted as emitted, and emission
 * coverage would under-report with no error to explain why.
 */
export function extractEmittedNodeIds(files: readonly EmittedFile[]): ReadonlySet<NodeId> {
  const ids = new Set<NodeId>();
  for (const file of files) {
    for (const match of file.contents.matchAll(ID_SHAPED_BRACKET_PATTERN)) {
      const candidate = match[1]!;
      if (!STRICT_NODE_ID_PATTERN.test(candidate)) {
        throw new Error(
          `${file.path} contains a bracketed, id-shaped string that isn't a well-formed node id: '[${candidate}]' (expected exactly three kebab-case segments, e.g. '[component/section/slug]')`
        );
      }
      ids.add(candidate);
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
