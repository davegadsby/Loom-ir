import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileCommand } from "./commands/compile.js";
import { validateCommand } from "./commands/validate.js";
import { reportCommand } from "./commands/report.js";
import { authorCommand } from "./commands/author.js";
import { tokensImportCommand } from "./commands/tokensImport.js";
import { loadComponent } from "./loadComponent.js";
import { writeLedger } from "loom-results";
import { validateLock, validateTokens, computeContentHash, type DesignTokens } from "loom-tokens";

const checkboxSpec = fileURLToPath(new URL("../../../examples/specs/checkbox.md", import.meta.url));

const figmaExportFixture = {
  status: 200,
  error: false,
  meta: {
    variableCollections: {
      "VariableCollectionId:1:3": {
        id: "VariableCollectionId:1:3",
        name: "Color",
        defaultModeId: "1:0",
        variableIds: ["VariableID:1:2"],
      },
    },
    variables: {
      "VariableID:1:2": {
        id: "VariableID:1:2",
        name: "color/surface/default",
        variableCollectionId: "VariableCollectionId:1:3",
        resolvedType: "COLOR",
        valuesByMode: { "1:0": { r: 1, g: 1, b: 1, a: 1 } },
      },
    },
  },
};

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

  it("tokensImportCommand converts a Figma export to DTCG tokens + a lock, both schema-valid", () => {
    const inPath = join(dir, "figma-export.json");
    writeFileSync(inPath, JSON.stringify(figmaExportFixture), "utf8");
    const outPath = join(dir, "design-tokens.json");

    const result = tokensImportCommand({ tool: "figma", in: inPath, out: outPath, sourceRef: "file:abc123" });

    expect(result.tokens).toEqual({ color: { surface: { default: { $value: "#ffffff", $type: "color" } } } });
    expect(() => validateTokens(result.tokens)).not.toThrow();
    expect(() => validateLock(result.lock)).not.toThrow();
    expect(result.lock).toMatchObject({ tool: "figma", sourceRef: "file:abc123", contentHash: computeContentHash(result.tokens) });

    // defaults --lock-out from --out, and both files actually land on disk
    expect(result.lockPath).toBe(join(dir, "design-tokens.lock.json"));
    expect(JSON.parse(readFileSync(outPath, "utf8"))).toEqual(result.tokens);
    expect(JSON.parse(readFileSync(result.lockPath, "utf8"))).toEqual(result.lock);
  });

  it("tokensImportCommand rejects an unsupported --tool instead of guessing a shape", () => {
    const inPath = join(dir, "export.json");
    writeFileSync(inPath, "{}", "utf8");
    expect(() => tokensImportCommand({ tool: "sketch", in: inPath, out: join(dir, "out.json") })).toThrow(
      /unsupported --tool 'sketch'/
    );
  });

  it("validateCommand runs the token-resolve and lock-staleness checks when --tokens/--lock are given", () => {
    const tokens: DesignTokens = {
      color: { surface: { default: { $value: "#fff", $type: "color" } } },
      spacing: { sm: { $value: "4px", $type: "dimension" } },
    };
    const tokensPath = join(dir, "design-tokens.json");
    writeFileSync(tokensPath, JSON.stringify(tokens), "utf8");

    const freshLockPath = join(dir, "fresh.lock.json");
    writeFileSync(
      freshLockPath,
      JSON.stringify({ tool: "figma", sourceRef: "x", contentHash: computeContentHash(tokens), importedAt: "2026-08-09T00:00:00Z" }),
      "utf8"
    );
    const fresh = validateCommand(checkboxSpec, { tokens: tokensPath, lock: freshLockPath });
    expect(fresh.tokensResolve).toEqual({ ok: true, issues: [] });
    expect(fresh.lockStaleness?.stale).toBe(false);

    const staleLockPath = join(dir, "stale.lock.json");
    writeFileSync(
      staleLockPath,
      JSON.stringify({ tool: "figma", sourceRef: "x", contentHash: "old-hash", importedAt: "2026-08-09T00:00:00Z" }),
      "utf8"
    );
    const stale = validateCommand(checkboxSpec, { tokens: tokensPath, lock: staleLockPath });
    expect(stale.lockStaleness?.stale).toBe(true);
  });

  it("validateCommand leaves visualReferences undefined for a spec with no image-kind reference (checkbox.md has a figma-frame one)", () => {
    const outcome = validateCommand(checkboxSpec, {});
    expect(outcome.visualReferences).toBeUndefined();
  });

  it("validateCommand runs the visual-reference existence check for a spec with an image-kind reference", () => {
    const specPath = join(dir, "swatch.md");
    writeFileSync(
      specPath,
      `---\nname: swatch\nkind: primitive\n---\n\n## Intent\n\nSwatch.\n\n## Style\n\n### matches-reference\n\n\`\`\`yaml\nkind: visual-conformance\nreference: { kind: image, path: reference.png }\n\`\`\`\n`,
      "utf8"
    );

    const missing = validateCommand(specPath, {});
    expect(missing.visualReferences).toEqual({ ok: false, issues: [{ nodeId: "swatch/style/matches-reference", path: "reference.png" }] });

    writeFileSync(join(dir, "reference.png"), "not-a-real-png", "utf8");
    const present = validateCommand(specPath, {});
    expect(present.visualReferences).toEqual({ ok: true, issues: [] });
  });

  it("loadComponent throws a clear error on an extends cycle instead of a stack overflow", () => {
    writeFileSync(
      join(dir, "a.md"),
      `---\nname: a\nkind: primitive\nextends: [b]\n---\n\n## Intent\n\nA.\n`,
      "utf8"
    );
    writeFileSync(
      join(dir, "b.md"),
      `---\nname: b\nkind: primitive\nextends: [a]\n---\n\n## Intent\n\nB.\n`,
      "utf8"
    );
    expect(() => loadComponent(join(dir, "a.md"))).toThrow(/circular spec reference/);
  });
});
