import { describe, expect, it } from "vitest";
import { deriveStatus } from "./status.js";
import { makeFixture } from "./fixtures.js";
import type { ResultsLedger } from "./ledger.js";

describe("deriveStatus", () => {
  const fixture = makeFixture();
  const emitted = new Set([
    "widget/claims/confirmed-one",
    "widget/claims/failing-one",
    "widget/claims/never-ran",
  ]);
  const ledger: ResultsLedger = {
    "widget/claims/confirmed-one": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
    "widget/claims/failing-one": { status: "failed", runAt: "2026-08-09T00:00:00Z" },
  };

  it("non-assertable nodes are not-applicable", () => {
    expect(deriveStatus(fixture.declarations[0]!, emitted, ledger)).toBe("not-applicable");
  });

  it("a passed test yields confirmed", () => {
    const node = fixture.claims.find((c) => c.id === "widget/claims/confirmed-one")!;
    expect(deriveStatus(node, emitted, ledger)).toBe("confirmed");
  });

  it("a failed test yields known-gap", () => {
    const node = fixture.claims.find((c) => c.id === "widget/claims/failing-one")!;
    expect(deriveStatus(node, emitted, ledger)).toBe("known-gap");
  });

  it("an emitted test with no ledger entry yields unverified", () => {
    const node = fixture.claims.find((c) => c.id === "widget/claims/never-ran")!;
    expect(deriveStatus(node, emitted, ledger)).toBe("unverified");
  });

  it("an assertable node with no emitted test yields unknown (coverage hole)", () => {
    const node = fixture.claims.find((c) => c.id === "widget/claims/no-test-emitted")!;
    expect(deriveStatus(node, emitted, ledger)).toBe("unknown");
  });

  it("UnexpressibleNode is always unverifiable, regardless of the ledger", () => {
    const node = fixture.claims.find((c) => c.kind === "unexpressible")!;
    expect(deriveStatus(node, emitted, ledger)).toBe("unverifiable");
    expect(deriveStatus(node, new Set([node.id]), { [node.id]: { status: "passed", runAt: "x" } })).toBe(
      "unverifiable"
    );
  });
});
