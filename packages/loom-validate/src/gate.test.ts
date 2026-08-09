import { describe, expect, it } from "vitest";
import { gate } from "./gate.js";
import type { Ratio } from "./coverage.js";

const coverage: { emission: Ratio; result: Ratio; expressibility: Ratio } = {
  emission: { total: 4, covered: 2, ratio: 0.5 },
  result: { total: 2, covered: 1, ratio: 0.5 },
  expressibility: { total: 4, covered: 3, ratio: 0.75 },
};

describe("gate", () => {
  it("passes when no thresholds are set", () => {
    expect(gate(coverage, {})).toEqual({ passed: true, failures: [] });
  });

  it("passes when all ratios clear their thresholds", () => {
    expect(gate(coverage, { emission: 0.5, result: 0.5, expressibility: 0.5 })).toEqual({ passed: true, failures: [] });
  });

  it("fails and reports every threshold that isn't cleared", () => {
    const result = gate(coverage, { emission: 0.9, result: 0.9, expressibility: 0.9 });
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(3);
    expect(result.failures[0]).toMatch(/emission coverage 50\.0% is below threshold 90\.0%/);
  });

  it("only checks thresholds that are actually set", () => {
    const result = gate(coverage, { emission: 0.9 });
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
  });
});
