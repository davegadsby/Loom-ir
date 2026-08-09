import type { LoomType } from "loom-expr";

/** Renders a LoomType as TypeScript source text. Small and duplicated (not shared via loom-ir) on purpose — this is an emission concern, not IR (§4). Identical to loom-emit-react's copy: both backends target TypeScript, but that's a language, not a framework. */
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
