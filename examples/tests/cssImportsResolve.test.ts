/**
 * Every stylesheet a generated component imports must exist where the component
 * says it does. Neither existing check covers this: `examplesUpToDate.test.ts`
 * compares text, and `tsc` is satisfied by the ambient `declare module "*.css"`.
 * Only a bundler resolves these paths for real — which is exactly why this went
 * unnoticed until Storybook's real Vite build hit it directly. Fixed by pointing
 * both emitters' CSS references at generated/styles/ (where examples/regenerate.ts
 * actually writes them) instead of assuming a sibling of the component.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const generatedDir = fileURLToPath(new URL("../generated", import.meta.url));

/** `import "./Checkbox.css";` and Angular's `styleUrls: ["./Checkbox.css"],`. */
function cssRefsIn(contents: string): string[] {
  const refs = [...contents.matchAll(/import\s+"([^"]+\.css)"/g)].map((m) => m[1]!);
  const styleUrls = contents.match(/styleUrls:\s*\[([^\]]*)\]/)?.[1] ?? "";
  refs.push(...[...styleUrls.matchAll(/"([^"]+\.css)"/g)].map((m) => m[1]!));
  return refs;
}

function componentFiles(): string[] {
  return (["react", "angular"] as const).flatMap((sub) =>
    readdirSync(join(generatedDir, sub)).map((f) => join(generatedDir, sub, f))
  );
}

describe("generated components' CSS imports", () => {
  it("resolve to files that actually exist", () => {
    const broken: string[] = [];
    for (const file of componentFiles()) {
      for (const ref of cssRefsIn(readFileSync(file, "utf8"))) {
        if (!existsSync(resolve(dirname(file), ref))) broken.push(`${file} -> ${ref}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
