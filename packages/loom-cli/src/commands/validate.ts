import { readFileSync } from "node:fs";
import { extractEmittedNodeIds, readLedger, type ResultsLedger } from "loom-results";
import { emitStorybookPlay } from "loom-emit-tests";
import type { DesignTokens, TokensLock } from "loom-tokens";
import {
  checkTokensLockStaleness,
  checkTokensResolve,
  computeEmissionCoverage,
  computeExpressibilityRatio,
  computeResultCoverage,
  gate,
  type GateResult,
  type Ratio,
  type TokensLockStalenessResult,
  type TokensResolveResult,
} from "loom-validate";
import { loadComponent } from "../loadComponent.js";
import { emitAllTests } from "../emitAllTests.js";

export interface ValidateOptions {
  results?: string;
  emissionThreshold?: number;
  resultThreshold?: number;
  expressibilityThreshold?: number;
  /** Path to a DTCG tokens JSON — enables the token-resolution check. */
  tokens?: string;
  /** Path to a tokens lock JSON — enables the staleness check. Requires `tokens`. */
  lock?: string;
}

export interface ValidateOutcome {
  emission: Ratio;
  result: Ratio;
  expressibility: Ratio;
  gate: GateResult;
  tokensResolve?: TokensResolveResult;
  lockStaleness?: TokensLockStalenessResult;
}

/** `loom validate <spec>` — parse → run coverage checks → gate (§8/§10), plus optional token checks. */
export function validateCommand(specPath: string, options: ValidateOptions = {}): ValidateOutcome {
  const component = loadComponent(specPath);
  // emitStorybookPlay is deliberately outside emitAllTests's bundle (its output must live
  // next to the compiled component, not a shared tests dir — see emitAllTests.ts), but its
  // scenario claims still need to count toward emission coverage here.
  const emittedIds = extractEmittedNodeIds([...emitAllTests(component), ...emitStorybookPlay(component)]);
  const ledger: ResultsLedger = options.results ? readLedger(options.results) : {};

  const emission = computeEmissionCoverage(component, emittedIds);
  const result = computeResultCoverage(emittedIds, ledger);
  const expressibility = computeExpressibilityRatio(component);

  const gateResult = gate(
    { emission, result, expressibility },
    {
      emission: options.emissionThreshold,
      result: options.resultThreshold,
      expressibility: options.expressibilityThreshold,
    }
  );

  let tokensResolve: TokensResolveResult | undefined;
  let lockStaleness: TokensLockStalenessResult | undefined;
  if (options.tokens) {
    const tokens = JSON.parse(readFileSync(options.tokens, "utf8")) as DesignTokens;
    tokensResolve = checkTokensResolve(component, tokens);
    if (options.lock) {
      const lock = JSON.parse(readFileSync(options.lock, "utf8")) as TokensLock;
      lockStaleness = checkTokensLockStaleness(lock, tokens);
    }
  }

  return { emission, result, expressibility, gate: gateResult, tokensResolve, lockStaleness };
}
