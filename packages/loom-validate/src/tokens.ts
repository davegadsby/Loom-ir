import { allNodes, type ComponentNode, type NodeId } from "loom-ir";
import { computeContentHash, tokenExists, type DesignTokens, type TokensLock } from "loom-tokens";

export interface TokenResolutionIssue {
  nodeId: NodeId;
  token: string;
}

export interface TokensResolveResult {
  ok: boolean;
  issues: TokenResolutionIssue[];
}

/**
 * Every `TokenRefNode.token` and `LayoutIntentNode.gapToken` must resolve
 * against the given `DesignTokens` — fails loudly on a typo'd or renamed
 * token instead of the CSS backend silently emitting `var(--undefined)`.
 */
export function checkTokensResolve(tree: ComponentNode, tokens: DesignTokens): TokensResolveResult {
  const issues: TokenResolutionIssue[] = [];
  for (const node of allNodes(tree)) {
    if (node.kind === "token-ref" && !tokenExists(node.token, tokens)) {
      issues.push({ nodeId: node.id, token: node.token });
    }
    if (node.kind === "layout-intent" && node.gapToken && !tokenExists(node.gapToken, tokens)) {
      issues.push({ nodeId: node.id, token: node.gapToken });
    }
  }
  return { ok: issues.length === 0, issues };
}

export interface TokensLockStalenessResult {
  stale: boolean;
  lockedHash: string;
  currentHash: string;
}

/**
 * Compares a `TokensLock.contentHash` against a fresh hash of the current
 * tokens file — the concrete shape of "Figma-lock staleness," a concept the
 * architecture doc named as existing pipeline machinery without ever
 * specifying it.
 */
export function checkTokensLockStaleness(lock: TokensLock, tokens: DesignTokens): TokensLockStalenessResult {
  const currentHash = computeContentHash(tokens);
  return { stale: currentHash !== lock.contentHash, lockedHash: lock.contentHash, currentHash };
}
