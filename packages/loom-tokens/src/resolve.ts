import type { DesignTokens, TokenGroup, TokenLeaf } from "./types.js";
import { isTokenLeaf } from "./types.js";

export class TokenResolutionError extends Error {}

/** Resolves a dot-path (`color.surface.default`) against a tokens tree, or throws with a precise reason. */
export function resolveToken(path: string, tokens: DesignTokens): TokenLeaf {
  const segments = path.split(".");
  let node: TokenLeaf | TokenGroup = tokens;

  segments.forEach((segment, i) => {
    if (isTokenLeaf(node)) {
      throw new TokenResolutionError(
        `token path '${path}' is too long — '${segments.slice(0, i).join(".")}' is already a leaf token`
      );
    }
    const next = node[segment];
    if (next === undefined) {
      const parent = segments.slice(0, i).join(".") || "<root>";
      throw new TokenResolutionError(`token path '${path}' does not resolve — no '${segment}' under '${parent}'`);
    }
    node = next;
  });

  if (!isTokenLeaf(node)) {
    throw new TokenResolutionError(`token path '${path}' resolves to a group, not a leaf token`);
  }
  return node;
}

export function tokenExists(path: string, tokens: DesignTokens): boolean {
  try {
    resolveToken(path, tokens);
    return true;
  } catch {
    return false;
  }
}
