// Entry point for the loom-angular-components package (see
// packages/loom-angular-components/), an ng-packagr-built library that lets
// Storybook import real, pre-compiled Angular components instead of
// AOT/JIT-compiling raw .component.ts source itself. Lives here, not inside
// packages/loom-angular-components/, because ng-packagr hardcodes its
// compilation rootDir to this file's own directory (ng-packagr's
// initializeTsConfig, `basePath = path.dirname(entryPoint.entryFilePath)`,
// unconditionally overrides any rootDir set in tsconfig) — the generated
// component files it re-exports live under examples/generated/angular/ and
// examples/material/generated/angular/, both of which are only reachable
// from a rootDir at examples/ itself.
//
// Thin re-export barrel, not a copy — examples/generated/angular/ and
// examples/material/generated/angular/ stay the real, drift-tested
// generator output. Only re-exports components that currently have Angular
// stories; extend as more stories are added.
export * from "./generated/angular/Checkbox.component";
export * from "./material/generated/angular/RadioGroup.component";
export * from "./material/generated/angular/Card.component";
