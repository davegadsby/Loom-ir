/**
 * A (trimmed) shape of Figma's real Variables REST API response —
 * `GET /v1/files/:file_key/variables/local`. This is the *only* file in the
 * whole design-tokens pipeline that names anything Figma-specific; swapping
 * to a different design tool means replacing this package, not anything
 * downstream of it.
 */
export type FigmaResolvedType = "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";

export interface FigmaColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type FigmaVariableValue = FigmaColorValue | number | string | boolean;

export interface FigmaVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: FigmaResolvedType;
  valuesByMode: Record<string, FigmaVariableValue>;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  defaultModeId: string;
  variableIds: string[];
}

export interface FigmaVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}
