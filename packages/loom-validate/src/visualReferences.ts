import { existsSync } from "node:fs";
import { join } from "node:path";
import { allNodes, type ComponentNode, type NodeId } from "loom-ir";

export interface VisualReferenceIssue {
  nodeId: NodeId;
  path: string;
}

export interface VisualReferencesResult {
  ok: boolean;
  issues: VisualReferenceIssue[];
}

/**
 * Every `image`-kind `VisualConformanceNode.reference.path` must exist on
 * disk, resolved relative to `specDir` (the spec file's own directory — same
 * resolution base `extends`/`uses` already use, see
 * `loom-cli/src/loadComponent.ts`'s `makeFileResolveBase`). `figma-frame`
 * references have nothing to check yet — a frame id isn't a resolvable local
 * path. Real pixel-diffing against the reference is a separate, swappable
 * concern (see `loom-visual-diff`) — this only catches the same class of
 * typo/rename mistake `checkTokensResolve` catches for design tokens.
 */
export function checkVisualReferencesExist(tree: ComponentNode, specDir: string): VisualReferencesResult {
  const issues: VisualReferenceIssue[] = [];
  for (const node of allNodes(tree)) {
    if (node.kind !== "visual-conformance" || node.reference.kind !== "image") continue;
    if (!existsSync(join(specDir, node.reference.path))) {
      issues.push({ nodeId: node.id, path: node.reference.path });
    }
  }
  return { ok: issues.length === 0, issues };
}
