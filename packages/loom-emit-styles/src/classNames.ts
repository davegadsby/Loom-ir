/**
 * The one place that defines how a component/part pair maps to a CSS class
 * name — shared by this package's own CSS output and, later, by
 * loom-emit-react/loom-emit-angular when they attach `className`/`class` to
 * the exact same DOM nodes (root + slot wrappers) they already render.
 */
export function partClassName(componentName: string, part: string): string {
  return part === "root" ? `loom-${componentName}` : `loom-${componentName}__${part}`;
}

/** `color.surface.default` -> `--color-surface-default`, the custom property a token path resolves to. */
export function tokenCssVar(tokenPath: string): string {
  return `--${tokenPath.split(".").join("-")}`;
}
