export type TokenType = "color" | "dimension" | "number" | "string";

export interface TokenLeaf {
  $value: string | number;
  $type: TokenType;
  $description?: string;
}

/** Nested by key path — `color.surface.default` is `tokens.color.surface.default`. */
export interface TokenGroup {
  [key: string]: TokenLeaf | TokenGroup;
}

/** A whole tokens file: the tool-agnostic core format (W3C DTCG-conformant) every downstream piece of the pipeline consumes. */
export type DesignTokens = TokenGroup;

export function isTokenLeaf(node: TokenLeaf | TokenGroup): node is TokenLeaf {
  return typeof node === "object" && node !== null && "$value" in node;
}

/**
 * Records which design tool produced the current tokens file and from what,
 * so staleness can be detected later. Deliberately generic — `tool` is a
 * free-form label an importer sets, never a hardcoded union of known tools.
 */
export interface TokensLock {
  tool: string;
  sourceRef: string;
  contentHash: string;
  importedAt: string;
}
