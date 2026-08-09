import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Ajv2020 as Ajv2020Class } from "ajv/dist/2020.js";
import type { Frontmatter } from "./types.js";

export type { Frontmatter } from "./types.js";

// ajv ships as CommonJS; loaded via createRequire to sidestep default-export
// ESM/CJS interop ambiguity under NodeNext (the `import type` above is
// erased at compile time and only supplies the class's static type).
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js") as unknown as typeof Ajv2020Class;

function loadSchema(relativePath: string): object {
  const path = fileURLToPath(new URL(`../schema/${relativePath}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

export const frontmatterSchema: object = loadSchema("frontmatter.schema.json");
export const sectionSchema: object = loadSchema("section.schema.json");

const ajv = new Ajv2020({ allErrors: true });
const validateFrontmatterSchema = ajv.compile(frontmatterSchema);
const validateSectionSchema = ajv.compile(sectionSchema);

export class SchemaValidationError extends Error {
  constructor(what: string, errors: unknown) {
    super(`${what} failed schema validation: ${JSON.stringify(errors)}`);
  }
}

export function validateFrontmatter(data: unknown): Frontmatter {
  if (!validateFrontmatterSchema(data)) {
    throw new SchemaValidationError("frontmatter", validateFrontmatterSchema.errors);
  }
  return data as Frontmatter;
}

/** Validates a single node's fenced ```yaml block against the §5.3 taxonomy shapes. */
export function validateNodeBlock(data: unknown): Record<string, unknown> {
  if (!validateSectionSchema(data)) {
    throw new SchemaValidationError("node block", validateSectionSchema.errors);
  }
  return data as Record<string, unknown>;
}
