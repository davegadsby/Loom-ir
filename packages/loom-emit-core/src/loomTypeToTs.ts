import type { LoomType } from "loom-expr";

/**
 * Renders a LoomType as TypeScript source text. Shared by both component
 * backends (Phase 1a of the render-tree reframe) — the two copies this
 * replaces were byte-identical apart from a comment: React and Angular differ
 * as frameworks, but both target TypeScript, which is a language, not a
 * framework, so the duplication bought no future independence.
 */
export function loomTypeToTs(type: LoomType): string {
  switch (type.kind) {
    case "bool":
      return "boolean";
    case "int":
    case "float":
      return "number";
    case "string":
      return "string";
    case "enum":
      return type.values.map((v) => JSON.stringify(v)).join(" | ");
    case "list":
      return `Array<${loomTypeToTs(type.of)}>`;
    case "option":
      return `${loomTypeToTs(type.of)} | null`;
    case "record":
      return `{ ${Object.entries(type.fields)
        .map(([k, v]) => `${k}: ${loomTypeToTs(v)}`)
        .join("; ")} }`;
    case "ref":
      return "string";
  }
}
