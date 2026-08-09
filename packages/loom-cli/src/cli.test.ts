import { describe, expect, it } from "vitest";
import { buildProgram } from "./cli.js";

describe("buildProgram", () => {
  it("registers the four commands: compile, validate, report, author", () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name()).sort();
    expect(names).toEqual(["author", "compile", "report", "validate"]);
  });
});
