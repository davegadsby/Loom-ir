import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLedger, writeLedger } from "./ledger.js";
import type { ResultsLedger } from "./ledger.js";

describe("readLedger / writeLedger", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "loom-results-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a ledger through disk", () => {
    const path = join(dir, "loom.results.json");
    const ledger: ResultsLedger = {
      "widget/claims/confirmed-one": { status: "passed", runAt: "2026-08-09T00:00:00Z", durationMs: 12 },
    };
    writeLedger(path, ledger);
    expect(readLedger(path)).toEqual(ledger);
  });
});
