import { extractEmittedNodeIds, readLedger, type ResultsLedger } from "loom-results";
import {
  computeEmissionCoverage,
  computeExpressibilityRatio,
  computeResultCoverage,
  gate,
  type GateResult,
  type Ratio,
} from "loom-validate";
import { loadComponent } from "../loadComponent.js";
import { emitAllTests } from "../emitAllTests.js";

export interface ValidateOptions {
  results?: string;
  emissionThreshold?: number;
  resultThreshold?: number;
  expressibilityThreshold?: number;
}

export interface ValidateOutcome {
  emission: Ratio;
  result: Ratio;
  expressibility: Ratio;
  gate: GateResult;
}

/** `loom validate <spec>` — parse → run coverage checks → gate (§8/§10). */
export function validateCommand(specPath: string, options: ValidateOptions = {}): ValidateOutcome {
  const component = loadComponent(specPath);
  const emittedIds = extractEmittedNodeIds(emitAllTests(component));
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

  return { emission, result, expressibility, gate: gateResult };
}
