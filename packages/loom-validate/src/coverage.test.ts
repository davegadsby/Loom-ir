import { describe, expect, it } from "vitest";
import type { ResultsLedger } from "loom-results";
import { computeEmissionCoverage, computeExpressibilityRatio, computeResultCoverage } from "./coverage.js";
import { makeFixture } from "./fixtures.js";

const emittedTestIds = new Set(["widget/claims/emitted-and-passed", "widget/claims/emitted-not-run"]);
const ledger: ResultsLedger = {
  "widget/claims/emitted-and-passed": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
};

describe("computeEmissionCoverage", () => {
  it("counts assertable nodes with an emitted test, including UnexpressibleNode dragging it down", () => {
    const coverage = computeEmissionCoverage(makeFixture(), emittedTestIds);
    expect(coverage).toEqual({ total: 4, covered: 2, ratio: 0.5 });
  });

  it("is vacuously 1 when there are no assertable nodes", () => {
    const fixture = makeFixture();
    fixture.claims = [];
    expect(computeEmissionCoverage(fixture, new Set())).toEqual({ total: 0, covered: 0, ratio: 1 });
  });
});

describe("computeResultCoverage", () => {
  it("counts emitted tests with a recorded result", () => {
    const coverage = computeResultCoverage(emittedTestIds, ledger);
    expect(coverage).toEqual({ total: 2, covered: 1, ratio: 0.5 });
  });
});

describe("computeExpressibilityRatio", () => {
  it("counts assertable claims that are machine-verifiable vs. UnexpressibleNode", () => {
    const ratio = computeExpressibilityRatio(makeFixture());
    expect(ratio).toEqual({ total: 4, covered: 3, ratio: 0.75 });
  });
});
