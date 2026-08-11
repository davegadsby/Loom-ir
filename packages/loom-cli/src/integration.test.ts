import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { extractEmittedNodeIds, joinResults, type ResultsLedger } from "loom-results";
import { computeEmissionCoverage, computeExpressibilityRatio, computeResultCoverage, gate } from "loom-validate";
import { emitStorybookPlay } from "loom-emit-tests";
import type { EmittedFile } from "loom-ir";
import { loadComponent } from "./loadComponent.js";
import { emitAllTests } from "./emitAllTests.js";

const checkboxSpec = fileURLToPath(new URL("../../../examples/specs/checkbox.md", import.meta.url));

// `emitStorybookPlay`'s output lives outside `emitAllTests`'s own bundle (it must sit next
// to the compiled component, not a shared tests dir — see emitAllTests.ts), but this test
// exercises emission coverage the same way `report`/`validate` really compute it, which
// does combine the two.
function emitAllTestsIncludingStorybook(component: Parameters<typeof emitAllTests>[0]): EmittedFile[] {
  return [...emitAllTests(component), ...emitStorybookPlay(component)];
}

/**
 * End-to-end proof of the §3 pipeline on the checkbox archetype: spec files
 * (with inheritance) → parser → one AST → two independent component
 * emitters → a test emitter → a results ledger → a derived-status report.
 * This is the concrete evidence for §14 step 7 — retargeting the *same* IR
 * tree to a second framework — and for §2's "results never live in the AST"
 * rule (the join produces a new structure, the parsed tree is never mutated).
 */
describe("full pipeline integration (checkbox archetype)", () => {
  it("parses once, flattens interactive-base, and drives both emitters from the same tree", () => {
    const component = loadComponent(checkboxSpec);

    // Inheritance flattened: the base's prop and property claim are present
    // under their *original* id, stamped as inherited-not-overridden.
    const disabled = component.declarations.find((d) => d.name === "disabled")!;
    expect(disabled.id).toBe("interactive-base/declarations/disabled");
    expect(disabled.origin).toEqual({ inheritedFrom: "interactive-base", overridden: false });

    const [reactFile] = emitReact(component);
    const [angularFile] = emitAngular(component);

    // Same machine data embedded in both — the only thing that changed is
    // framework idiom (JSX vs. decorators/template), not the underlying tree.
    for (const marker of ['"id":"unchecked"', '"id":"checked"', 'id: "toggle-on"', 'id: "toggle-off"']) {
      expect(reactFile!.contents).toContain(marker);
      expect(angularFile!.contents).toContain(marker);
    }
    // `onChange`/`(change)`, not `onClick`/`(click)` — checkbox is a real `<input
    // type="checkbox">` (§ Phase 5e); the dispatched event name stays "click" (matching
    // the transitions' own declared trigger), only the DOM binding it prints under changes.
    expect(reactFile!.contents).toContain('onChange={() => { dispatch("click"); }}');
    expect(angularFile!.contents).toContain(`(change)="dispatch('click')"`);
  });

  it("joins a results ledger onto the tree and derives the full §9 status spread without mutating the AST", () => {
    const component = loadComponent(checkboxSpec);
    const beforeJoin = JSON.stringify(component);

    const testFiles = emitAllTestsIncludingStorybook(component);
    const emittedIds = extractEmittedNodeIds(testFiles);

    // Every assertable claim except the UnexpressibleNode gets a test from
    // one of the three emit-tests backends (jest/storybook/axe).
    expect(emittedIds.has("checkbox/claims/transitions-stay-within-declared-states")).toBe(true);
    expect(emittedIds.has("checkbox/claims/click-checks-an-unchecked-box")).toBe(true);
    expect(emittedIds.has("checkbox/claims/click-unchecks-a-checked-box")).toBe(true);
    expect(emittedIds.has("checkbox/a11y/checkbox-pattern")).toBe(true);
    expect(emittedIds.has("interactive-base/claims/disabled-not-focusable")).toBe(true);
    expect(emittedIds.has("checkbox/claims/touch-latency-feels-instant")).toBe(false);

    const ledger: ResultsLedger = {
      "checkbox/claims/transitions-stay-within-declared-states": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
      "interactive-base/claims/disabled-not-focusable": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
    };

    const report = joinResults(component, emittedIds, ledger);
    const statusOf = (id: string) => report.find((r) => r.id === id)?.status;

    expect(statusOf("checkbox/claims/transitions-stay-within-declared-states")).toBe("confirmed");
    expect(statusOf("interactive-base/claims/disabled-not-focusable")).toBe("confirmed");
    expect(statusOf("checkbox/claims/click-checks-an-unchecked-box")).toBe("unverified");
    expect(statusOf("checkbox/a11y/checkbox-pattern")).toBe("unverified");
    expect(statusOf("checkbox/claims/touch-latency-feels-instant")).toBe("unverifiable");

    // Results never live in the AST (§2): the tree itself is untouched by the join.
    expect(JSON.stringify(component)).toBe(beforeJoin);
  });

  it("computes coverage ratios that reflect the UnexpressibleNode dragging emission/expressibility down", () => {
    const component = loadComponent(checkboxSpec);
    const emittedIds = extractEmittedNodeIds(emitAllTestsIncludingStorybook(component));
    const ledger: ResultsLedger = {
      "checkbox/claims/transitions-stay-within-declared-states": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
      "interactive-base/claims/disabled-not-focusable": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
    };

    const emission = computeEmissionCoverage(component, emittedIds);
    const result = computeResultCoverage(emittedIds, ledger);
    const expressibility = computeExpressibilityRatio(component);

    // 9 assertable nodes total (4 checkbox claims — the two scenario claims,
    // both toggle directions, plus 1 inherited property + 1 a11y node + 3
    // style nodes), 6 emitted (the 4th style node, layout-intent, and
    // visual-conformance have no emitted-test backend).
    expect(emission).toEqual({ total: 9, covered: 6, ratio: 6 / 9 });
    // Of the 6 emitted, 2 have a recorded result.
    expect(result).toEqual({ total: 6, covered: 2, ratio: 2 / 6 });
    // 8 of 9 assertable claims are machine-verifiable; 1 is UnexpressibleNode.
    expect(expressibility).toEqual({ total: 9, covered: 8, ratio: 8 / 9 });

    expect(gate({ emission, result, expressibility }, { expressibility: 0.8 }).passed).toBe(true);
    expect(gate({ emission, result, expressibility }, { result: 0.9 }).passed).toBe(false);
  });
});
