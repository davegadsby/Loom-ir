import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileCommand } from "./commands/compile.js";
import { validateCommand } from "./commands/validate.js";
import { reportCommand } from "./commands/report.js";
import { authorCommand } from "./commands/author.js";
import { writeLedger } from "loom-results";

const checkboxSpec = fileURLToPath(new URL("../../../examples/specs/checkbox.md", import.meta.url));

describe("loom-cli commands", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "loom-cli-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("compileCommand writes a React component plus test files to --out", () => {
    const out = join(dir, "out");
    const files = compileCommand(checkboxSpec, { target: "react", out });
    expect(files.some((f) => f.path === "Checkbox.tsx")).toBe(true);
    expect(existsSync(join(out, "Checkbox.tsx"))).toBe(true);
    expect(existsSync(join(out, "checkbox.jest.test.ts"))).toBe(true);
    const written = readFileSync(join(out, "Checkbox.tsx"), "utf8");
    expect(written).toContain("export function Checkbox");
  });

  it("compileCommand supports the angular target from the same spec", () => {
    const out = join(dir, "out-ng");
    const files = compileCommand(checkboxSpec, { target: "angular", out });
    expect(files.some((f) => f.path === "Checkbox.component.ts")).toBe(true);
    expect(existsSync(join(out, "Checkbox.component.ts"))).toBe(true);
  });

  it("validateCommand reports coverage ratios and gates on thresholds", () => {
    const outcome = validateCommand(checkboxSpec, {});
    expect(outcome.emission.total).toBeGreaterThan(0);
    expect(outcome.gate.passed).toBe(true);

    const failing = validateCommand(checkboxSpec, { emissionThreshold: 0.99 });
    expect(failing.gate.passed).toBe(false);
    expect(failing.gate.failures[0]).toMatch(/emission coverage/);
  });

  it("reportCommand joins a results ledger onto derived status", () => {
    const ledgerPath = join(dir, "loom.results.json");
    writeLedger(ledgerPath, {
      "checkbox/claims/transitions-stay-within-declared-states": { status: "passed", runAt: "2026-08-09T00:00:00Z" },
    });
    const report = reportCommand(checkboxSpec, { results: ledgerPath });
    const entry = report.find((r) => r.id === "checkbox/claims/transitions-stay-within-declared-states");
    expect(entry?.status).toBe("confirmed");
    const unexpressible = report.find((r) => r.id === "checkbox/claims/touch-latency-feels-instant");
    expect(unexpressible?.status).toBe("unverifiable");
  });

  it("authorCommand scaffolds a new spec file with valid frontmatter", () => {
    const path = authorCommand("my-widget", { out: dir });
    expect(existsSync(path)).toBe(true);
    const contents = readFileSync(path, "utf8");
    expect(contents).toContain("name: my-widget");
    expect(contents).toContain("## Intent");
  });
});
