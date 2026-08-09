import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EmittedFile } from "loom-ir";
import { emitReact } from "loom-emit-react";
import { emitAngular } from "loom-emit-angular";
import { loadComponent } from "../loadComponent.js";
import { emitAllTests } from "../emitAllTests.js";

export type CompileTarget = "react" | "angular";

export interface CompileOptions {
  target: CompileTarget;
  out: string;
}

export function writeFiles(outDir: string, files: readonly EmittedFile[]): void {
  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(outDir, file.path), file.contents, "utf8");
  }
}

/** `loom compile <spec> --target react|angular` — parse → emit component + tests (§3 pipeline). */
export function compileCommand(specPath: string, options: CompileOptions): EmittedFile[] {
  const component = loadComponent(specPath);
  const componentFiles = options.target === "react" ? emitReact(component) : emitAngular(component);
  const testFiles = emitAllTests(component);
  const files = [...componentFiles, ...testFiles];
  writeFiles(options.out, files);
  return files;
}
