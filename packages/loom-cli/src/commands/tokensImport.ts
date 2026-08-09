import { readFileSync, writeFileSync } from "node:fs";
import type { DesignTokens, TokensLock } from "loom-tokens";
import { importFigmaVariables, type FigmaVariablesResponse } from "loom-tokens-import-figma";

export interface TokensImportOptions {
  /** Which design tool's export shape to read. Only `"figma"` is wired up so far. */
  tool: string;
  in: string;
  out: string;
  /** Defaults to `<out>` with its extension replaced by `.lock.json`. */
  lockOut?: string;
  /** Identifies the source design file on the written lock. Defaults to `--in`. */
  sourceRef?: string;
}

export interface TokensImportResult {
  tokens: DesignTokens;
  lock: TokensLock;
  tokensPath: string;
  lockPath: string;
}

/**
 * `loom tokens import --tool <tool> --in <export.json> --out <tokens.json>`.
 * `--tool` exists specifically so the CLI surface itself demonstrates the
 * swappable-importer story: adding a second design tool means writing one
 * more `loom-tokens-import-<tool>` package and one more branch here — the
 * DTCG tokens/lock shapes this writes never change.
 */
export function tokensImportCommand(options: TokensImportOptions): TokensImportResult {
  const raw = readFileSync(options.in, "utf8");
  const sourceRef = options.sourceRef ?? options.in;

  let tokens: DesignTokens;
  let lock: TokensLock;
  switch (options.tool) {
    case "figma": {
      const response = JSON.parse(raw) as FigmaVariablesResponse;
      ({ tokens, lock } = importFigmaVariables(response, { sourceRef }));
      break;
    }
    default:
      throw new Error(`unsupported --tool '${options.tool}' — only 'figma' is wired up so far`);
  }

  const lockPath = options.lockOut ?? options.out.replace(/\.json$/, ".lock.json");
  writeFileSync(options.out, JSON.stringify(tokens, null, 2) + "\n", "utf8");
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");

  return { tokens, lock, tokensPath: options.out, lockPath };
}
