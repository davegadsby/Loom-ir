import type { DesignTokens, TokenGroup, TokenLeaf } from "loom-tokens";
import type { FigmaColorValue, FigmaVariable, FigmaVariablesResponse } from "./figmaTypes.js";

export class FigmaImportError extends Error {}

/** Top-level Figma variable path segments treated as CSS dimensions (px) rather than bare numbers. */
const DIMENSION_GROUPS = new Set(["spacing", "sizing", "radius", "size"]);

function figmaColorToCss(color: FigmaColorValue): string {
  const channel = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  if (color.a === 1) {
    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  }
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
}

function toLeaf(variable: FigmaVariable, defaultModeId: string, pathSegments: readonly string[]): TokenLeaf {
  const value = variable.valuesByMode[defaultModeId];
  if (value === undefined) {
    throw new FigmaImportError(`variable '${variable.name}' has no value for the collection's default mode`);
  }

  switch (variable.resolvedType) {
    case "COLOR":
      return { $value: figmaColorToCss(value as FigmaColorValue), $type: "color" };
    case "FLOAT": {
      const isDimension = DIMENSION_GROUPS.has(pathSegments[0] ?? "");
      return isDimension ? { $value: `${value as number}px`, $type: "dimension" } : { $value: value as number, $type: "number" };
    }
    case "STRING":
      return { $value: value as string, $type: "string" };
    case "BOOLEAN":
      throw new FigmaImportError(
        `variable '${variable.name}' is a Figma BOOLEAN variable — the core tokens type system (color | dimension | number | string) has no boolean type yet; not imported`
      );
  }
}

/**
 * Converts a Figma Variables API response into the tool-agnostic DTCG
 * format. Only the collection's *default* mode is imported — multi-mode
 * variables (e.g. a light/dark theme pair) collapse to their default value;
 * importing every mode as a separate token set is a real feature a Figma
 * spec would eventually need, deliberately left out of this pass rather
 * than guessed at.
 */
export function convertFigmaVariablesToTokens(response: FigmaVariablesResponse): DesignTokens {
  const tokens: DesignTokens = {};

  for (const variable of Object.values(response.meta.variables)) {
    const collection = response.meta.variableCollections[variable.variableCollectionId];
    if (!collection) {
      throw new FigmaImportError(`variable '${variable.name}' references an unknown collection`);
    }

    const pathSegments = variable.name.split("/").map((s) => s.trim());
    const leaf = toLeaf(variable, collection.defaultModeId, pathSegments);

    let group: TokenGroup = tokens;
    pathSegments.slice(0, -1).forEach((segment) => {
      const existing = group[segment];
      if (existing && "$value" in existing) {
        throw new FigmaImportError(`variable path collides with an existing leaf token at '${segment}'`);
      }
      group = (group[segment] as TokenGroup) ?? (group[segment] = {});
    });
    group[pathSegments[pathSegments.length - 1]!] = leaf;
  }

  return tokens;
}
