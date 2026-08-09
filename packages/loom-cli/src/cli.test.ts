import { describe, expect, it } from "vitest";
import { buildProgram } from "./cli.js";

describe("buildProgram", () => {
  it("registers the five commands: compile, validate, report, author, tokens", () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name()).sort();
    expect(names).toEqual(["author", "compile", "report", "tokens", "validate"]);
  });

  it("registers 'tokens import' as a subcommand of 'tokens'", () => {
    const program = buildProgram();
    const tokens = program.commands.find((c) => c.name() === "tokens")!;
    expect(tokens.commands.map((c) => c.name())).toEqual(["import"]);
  });
});
