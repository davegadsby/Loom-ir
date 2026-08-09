import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Ajv2020 as Ajv2020Class } from "ajv/dist/2020.js";
import type { DesignTokens, TokensLock } from "./types.js";

// ajv ships as CommonJS; loaded via createRequire to sidestep default-export
// ESM/CJS interop ambiguity under NodeNext (see the same pattern in loom-schema).
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js") as unknown as typeof Ajv2020Class;

function loadSchema(relativePath: string): object {
  const path = fileURLToPath(new URL(`../schema/${relativePath}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

export const tokensSchema: object = loadSchema("tokens.schema.json");
export const lockSchema: object = loadSchema("lock.schema.json");

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
const validateTokensSchema = ajv.compile(tokensSchema);
const validateLockSchema = ajv.compile(lockSchema);

export class SchemaValidationError extends Error {
  constructor(what: string, errors: unknown) {
    super(`${what} failed schema validation: ${JSON.stringify(errors)}`);
  }
}

export function validateTokens(data: unknown): DesignTokens {
  if (!validateTokensSchema(data)) {
    throw new SchemaValidationError("tokens file", validateTokensSchema.errors);
  }
  return data as DesignTokens;
}

export function validateLock(data: unknown): TokensLock {
  if (!validateLockSchema(data)) {
    throw new SchemaValidationError("tokens lock file", validateLockSchema.errors);
  }
  return data as TokensLock;
}
