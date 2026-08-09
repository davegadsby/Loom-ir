import { describe, expect, it } from "vitest";
import { parseSections } from "./markdown.js";

describe("parseSections", () => {
  it("treats intent/rationale as single prose blocks with no ### needed", () => {
    const sections = parseSections(`## Intent

Some prose here.

More prose.
`);
    expect(sections).toEqual([{ heading: "intent", blocks: [{ slug: "intent", prose: "Some prose here.\n\nMore prose." }] }]);
  });

  it("parses ### sub-blocks with a fenced yaml block and trailing prose", () => {
    const sections = parseSections(`## Declarations

### disabled

\`\`\`yaml
kind: prop
type: bool
\`\`\`

Whether it's disabled.
`);
    expect(sections).toEqual([
      {
        heading: "declarations",
        blocks: [{ slug: "disabled", yaml: { kind: "prop", type: "bool" }, prose: "Whether it's disabled." }],
      },
    ]);
  });

  it("throws when a ### heading appears before any ## section", () => {
    expect(() => parseSections("### orphan\n")).toThrow(/before any/);
  });

  it("throws when a prose-only section gets a ### sub-heading", () => {
    expect(() => parseSections("## Intent\n\n### not-allowed\n")).toThrow(/does not take/);
  });

  it("throws on an unterminated fenced yaml block", () => {
    expect(() => parseSections("## Declarations\n\n### x\n\n```yaml\nkind: prop\n")).toThrow(/unterminated/);
  });

  it("rejects a non-kebab-case heading", () => {
    expect(() => parseSections("## Not Kebab Case\n")).toThrow(/kebab-case/);
  });
});
