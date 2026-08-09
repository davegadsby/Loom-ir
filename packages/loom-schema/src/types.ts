/**
 * Hand-authored counterpart to frontmatter.schema.json — kept in sync by hand
 * for this pass (no schema-to-TS codegen wired up yet).
 */
export interface Frontmatter {
  name: string;
  kind: "primitive" | "composite" | "pattern";
  category?: string;
  extends?: string[];
}
