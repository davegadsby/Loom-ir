import { describe, expect, it } from "vitest";
import type { EmittedFile } from "loom-ir";
import { extractEmittedNodeIds, joinResults } from "./join.js";
import { makeFixture } from "./fixtures.js";
import type { ResultsLedger } from "./ledger.js";

describe("extractEmittedNodeIds", () => {
  it("recovers node ids from the bracketed convention across emitted files", () => {
    const files: EmittedFile[] = [
      { path: "a.test.ts", contents: `it("[widget/claims/confirmed-one] invariant", () => {});` },
      { path: "b.test.ts", contents: `// [widget/claims/failing-one] some comment` },
    ];
    expect(extractEmittedNodeIds(files)).toEqual(new Set(["widget/claims/confirmed-one", "widget/claims/failing-one"]));
  });

  it("returns an empty set for files with no bracketed ids", () => {
    expect(extractEmittedNodeIds([{ path: "x.ts", contents: "nothing here" }])).toEqual(new Set());
  });

  it("throws on a bracketed, id-shaped string with the wrong number of segments, rather than silently failing to count it", () => {
    expect(() =>
      extractEmittedNodeIds([{ path: "bad.ts", contents: `it("[widget/claims] invariant", () => {});` }])
    ).toThrow(/well-formed node id/);
    expect(() =>
      extractEmittedNodeIds([{ path: "bad.ts", contents: `it("[widget/claims/one/extra] invariant", () => {});` }])
    ).toThrow(/well-formed node id/);
  });

  it("does not false-positive on a bracketed JSON array literal containing a slash-bearing string", () => {
    const files = [
      {
        path: "styles.ts",
        contents: `const __component: any = {"name":"widget","style":[{"id":"widget/style/root-background"}]};`,
      },
    ];
    // The id inside the JSON blob is quoted, not bracketed directly, so it's untouched by
    // this scan — extractEmittedNodeIds only recognizes the emitters' own `[id]` convention.
    expect(extractEmittedNodeIds(files)).toEqual(new Set());
  });
});

describe("joinResults", () => {
  it("returns a new report array without mutating the tree (§2: results never in the AST)", () => {
    const fixture = makeFixture();
    const before = JSON.stringify(fixture);
    const emitted = new Set(["widget/claims/confirmed-one"]);
    const ledger: ResultsLedger = { "widget/claims/confirmed-one": { status: "passed", runAt: "2026-08-09T00:00:00Z" } };

    const report = joinResults(fixture, emitted, ledger);

    expect(JSON.stringify(fixture)).toBe(before);
    const entry = report.find((r) => r.id === "widget/claims/confirmed-one");
    expect(entry).toEqual({ id: "widget/claims/confirmed-one", kind: "invariant", status: "confirmed" });
  });

  it("covers every node in the tree, including the root and non-assertable nodes", () => {
    const fixture = makeFixture();
    const report = joinResults(fixture, new Set(), {});
    expect(report.map((r) => r.id)).toContain("widget");
    expect(report.map((r) => r.id)).toContain("widget/declarations/disabled");
    expect(report.find((r) => r.id === "widget")!.status).toBe("not-applicable");
  });
});
