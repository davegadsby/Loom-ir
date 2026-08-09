/**
 * The Loom expression language's type system (architecture §6.3).
 *
 * Primitive | Structured | References — deliberately small: no user-defined
 * types, no generics beyond the fixed list/option/record shapes below.
 */
export type LoomType =
  | { kind: "bool" }
  | { kind: "int" }
  | { kind: "float" }
  | { kind: "string" }
  | { kind: "enum"; name: string; values: readonly string[] }
  | { kind: "list"; of: LoomType }
  | { kind: "option"; of: LoomType }
  | { kind: "record"; fields: Readonly<Record<string, LoomType>> }
  | { kind: "ref"; refKind: "state" | "prop"; of: string };

/** Runtime values the interpreter and sampler produce/consume. `null` is option-none. */
export type LoomValue =
  | boolean
  | number
  | string
  | null
  | LoomValue[]
  | { readonly [key: string]: LoomValue };

export function typeEquals(a: LoomType, b: LoomType): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "bool":
    case "int":
    case "float":
    case "string":
      return true;
    case "enum":
      return (
        b.kind === "enum" &&
        a.name === b.name &&
        a.values.length === b.values.length &&
        a.values.every((v, i) => v === b.values[i])
      );
    case "list":
      return b.kind === "list" && typeEquals(a.of, b.of);
    case "option":
      return b.kind === "option" && typeEquals(a.of, b.of);
    case "record": {
      if (b.kind !== "record") return false;
      const aKeys = Object.keys(a.fields).sort();
      const bKeys = Object.keys(b.fields).sort();
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((k, i) => k === bKeys[i] && typeEquals(a.fields[k]!, b.fields[k]!));
    }
    case "ref":
      return b.kind === "ref" && a.refKind === b.refKind && a.of === b.of;
  }
}

export function typeToString(t: LoomType): string {
  switch (t.kind) {
    case "bool":
    case "int":
    case "float":
    case "string":
      return t.kind;
    case "enum":
      return `enum<${t.name}>`;
    case "list":
      return `list<${typeToString(t.of)}>`;
    case "option":
      return `option<${typeToString(t.of)}>`;
    case "record":
      return `record{${Object.entries(t.fields)
        .map(([k, v]) => `${k}: ${typeToString(v)}`)
        .join(", ")}}`;
    case "ref":
      return `ref<${t.of}>`;
  }
}
