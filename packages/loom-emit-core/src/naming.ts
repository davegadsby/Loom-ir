export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

export function pascalCase(slug: string): string {
  return slug.split("-").map(capitalize).join("");
}

/** Prop/slot/field names come from spec slugs and may contain hyphens, which aren't valid in a JS identifier. */
export function camelCase(slug: string): string {
  const [first, ...rest] = slug.split("-");
  return [first, ...rest.map(capitalize)].join("");
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * A spec-declared name (prop/field/derived) used as an object *literal* key —
 * `{ [key]: value }` — not an HTML/JSX attribute name, where a hyphen is
 * always valid. Bare when the name is already a valid JS identifier
 * (matching today's output byte-for-byte for every existing single-word
 * name); quoted otherwise, since `{ submit-disabled: x }` parses as
 * subtraction, not a key, and is a hard syntax error.
 */
export function objectKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}
