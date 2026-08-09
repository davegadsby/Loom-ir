import type { Ratio } from "./coverage.js";

export interface CoverageThresholds {
  emission?: number;
  result?: number;
  expressibility?: number;
}

export interface GateResult {
  passed: boolean;
  failures: string[];
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * CI gate over coverage ratios (§8/§10). The validator's role under Loom IR:
 * not "did a human remember to update a status tag" but "is the tree fully
 * covered by results."
 */
export function gate(
  coverage: { emission: Ratio; result: Ratio; expressibility: Ratio },
  thresholds: CoverageThresholds
): GateResult {
  const failures: string[] = [];

  if (thresholds.emission !== undefined && coverage.emission.ratio < thresholds.emission) {
    failures.push(`emission coverage ${pct(coverage.emission.ratio)} is below threshold ${pct(thresholds.emission)}`);
  }
  if (thresholds.result !== undefined && coverage.result.ratio < thresholds.result) {
    failures.push(`result coverage ${pct(coverage.result.ratio)} is below threshold ${pct(thresholds.result)}`);
  }
  if (thresholds.expressibility !== undefined && coverage.expressibility.ratio < thresholds.expressibility) {
    failures.push(
      `expressibility ratio ${pct(coverage.expressibility.ratio)} is below threshold ${pct(thresholds.expressibility)}`
    );
  }

  return { passed: failures.length === 0, failures };
}
