import { createHash } from "node:crypto";
import type { DesignTokens } from "./types.js";

/** Deterministic regardless of key order — object keys are sorted recursively before stringifying. */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Content hash used by the tokens lock to detect drift between what was imported and what's currently on disk. */
export function computeContentHash(tokens: DesignTokens): string {
  return createHash("sha256").update(canonicalStringify(tokens)).digest("hex");
}
