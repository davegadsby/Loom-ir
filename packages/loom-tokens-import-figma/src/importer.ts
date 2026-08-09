import type { DesignTokens, TokensLock } from "loom-tokens";
import { computeContentHash } from "loom-tokens";
import { convertFigmaVariablesToTokens } from "./convert.js";
import type { FigmaVariablesResponse } from "./figmaTypes.js";

export interface ImportFigmaVariablesOptions {
  /** Identifies the source Figma file (e.g. its file key) — stored on the lock, never interpreted downstream. */
  sourceRef: string;
  /** Injectable for deterministic tests; defaults to the real current time. */
  now?: () => Date;
}

export interface ImportFigmaVariablesResult {
  tokens: DesignTokens;
  lock: TokensLock;
}

/**
 * The one function in the whole pipeline that actually knows Figma's export
 * shape. Everything it returns downstream — `tokens` and `lock` — is
 * generic: a `loom-tokens-import-<other tool>` package producing the same
 * two shapes is a drop-in replacement.
 */
export function importFigmaVariables(
  response: FigmaVariablesResponse,
  options: ImportFigmaVariablesOptions
): ImportFigmaVariablesResult {
  const tokens = convertFigmaVariablesToTokens(response);
  const now = options.now ?? (() => new Date());
  const lock: TokensLock = {
    tool: "figma",
    sourceRef: options.sourceRef,
    contentHash: computeContentHash(tokens),
    importedAt: now().toISOString(),
  };
  return { tokens, lock };
}
