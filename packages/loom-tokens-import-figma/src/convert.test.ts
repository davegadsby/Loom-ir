import { describe, expect, it } from "vitest";
import { convertFigmaVariablesToTokens, FigmaImportError } from "./convert.js";
import { makeFigmaVariablesFixture } from "./fixtures.js";

describe("convertFigmaVariablesToTokens", () => {
  it("nests variables by their '/'-separated name into DTCG groups", () => {
    const tokens = convertFigmaVariablesToTokens(makeFigmaVariablesFixture());
    expect(tokens).toEqual({
      color: {
        surface: {
          default: { $value: "#f5f5f5", $type: "color" },
          disabled: { $value: "#e0e0e0", $type: "color" },
        },
      },
      spacing: {
        sm: { $value: "4px", $type: "dimension" },
        md: { $value: "8px", $type: "dimension" },
      },
    });
  });

  it("converts a FLOAT variable outside a dimension group to a plain number", () => {
    const response = makeFigmaVariablesFixture();
    response.meta.variableCollections["VariableCollectionId:1:6"]!.name = "Motion";
    response.meta.variables["VariableID:1:5"]!.name = "motion/z-index";
    const tokens = convertFigmaVariablesToTokens(response);
    expect((tokens.motion as Record<string, unknown>)["z-index"]).toEqual({ $value: 4, $type: "number" });
  });

  it("throws a clear error for an unsupported BOOLEAN variable", () => {
    const response = makeFigmaVariablesFixture();
    response.meta.variables["VariableID:1:5"]!.resolvedType = "BOOLEAN";
    response.meta.variables["VariableID:1:5"]!.valuesByMode = { "1:0": true };
    expect(() => convertFigmaVariablesToTokens(response)).toThrow(FigmaImportError);
  });

  it("throws when a variable references an unknown collection", () => {
    const response = makeFigmaVariablesFixture();
    response.meta.variables["VariableID:1:5"]!.variableCollectionId = "VariableCollectionId:missing";
    expect(() => convertFigmaVariablesToTokens(response)).toThrow(/unknown collection/);
  });
});
