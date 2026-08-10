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
