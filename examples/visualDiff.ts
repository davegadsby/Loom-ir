#!/usr/bin/env -S npx tsx
/**
 * A first, real screenshot-diff loop for `VisualConformanceNode`'s `image`
 * references (`packages/loom-ir/src/nodes.ts`'s `VisualReference`) —
 * deliberately a manual, advisory tool, not a blocking CI gate: renders one
 * live Storybook story in a real browser, screenshots its root
 * `[data-loom-component]` element, and pixel-diffs that screenshot against a
 * reference image via `loom-visual-diff`'s `diffImages`. Prints a similarity
 * report and writes a diff overlay image for a human (or an iterating agent)
 * to look at, adjust the spec's `## Style` section against, and re-run —
 * the same loop this repo's own contributors already run by hand when
 * checking a component's appearance.
 *
 * `checkVisualReferencesExist` (`packages/loom-validate/src/visualReferences.ts`)
 * is the separate, cheap, always-run tier that only confirms the *reference
 * itself* exists on disk — this script is the tier above it, and needs a
 * real browser, so it stays a manual command
 * (`pnpm visual:diff -- --story <id> --reference <path>`) rather than
 * something `loom validate` runs unconditionally.
 *
 * Never fails on the diff *ratio* itself — no similarity threshold is
 * enforced, since "close enough" is a human/agent judgment call, not a
 * pass/fail one. A genuine usage or infra error (missing reference file,
 * failed Storybook build, unreachable server) still exits nonzero — that's
 * a real failure to run the tool, not a verdict on the comparison.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { diffImages } from "loom-visual-diff";

const STORYBOOK_PORT = 6061;

interface Args {
  story: string;
  reference: string;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value) throw new Error(`--${flag.slice(2)} requires a value`);
    values[flag.slice(2)] = value;
    i++;
  }
  if (!values.story) throw new Error("--story <storybook-story-id> is required (e.g. material-radiobutton--checked)");
  if (!values.reference) throw new Error("--reference <path-to-image> is required");
  return { story: values.story, reference: values.reference, out: values.out };
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`storybook server at ${url} did not become reachable within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  const { story, reference, out } = parseArgs(process.argv.slice(2));

  if (!existsSync(reference)) {
    throw new Error(`reference image not found: ${reference}`);
  }

  console.log("Building Storybook...");
  const build = spawnSync("npx", ["storybook", "build", "--quiet"], { stdio: "inherit" });
  if (build.status !== 0) {
    throw new Error("storybook build failed");
  }

  console.log(`Serving storybook-static on port ${STORYBOOK_PORT}...`);
  const server = spawn("npx", ["http-server", "storybook-static", "--port", String(STORYBOOK_PORT), "--silent"], {
    stdio: "ignore",
  });

  try {
    await waitForServer(`http://localhost:${STORYBOOK_PORT}/index.json`, 30000);

    const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    let actualPng: Buffer;
    try {
      const page = await browser.newPage();
      await page.goto(`http://localhost:${STORYBOOK_PORT}/iframe.html?id=${story}&viewMode=story`, { waitUntil: "networkidle" });
      const root = page.locator("[data-loom-component]").first();
      await root.waitFor({ state: "visible" });
      actualPng = await root.screenshot();
    } finally {
      await browser.close();
    }

    const result = diffImages(actualPng, readFileSync(reference));
    const similarity = ((1 - result.ratio) * 100).toFixed(1);
    console.log(
      `${story}: ${similarity}% similar (${result.diffPixels.toLocaleString()} / ${result.totalPixels.toLocaleString()} px differ)`
    );

    const outPath = out ?? reference.replace(/(\.[^./]+)$/, ".diff$1");
    writeFileSync(outPath, result.diffPng);
    console.log(`wrote diff overlay to ${outPath}`);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
