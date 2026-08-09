import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface AuthorOptions {
  out: string;
}

function template(name: string): string {
  return `---
name: ${name}
kind: primitive
category: uncategorized
---

## Intent

TODO: describe what \`${name}\` is and does.

## Declarations

<!-- ### some-prop

\`\`\`yaml
kind: prop
type: bool
default: false
\`\`\`

Description of some-prop. -->

## Claims

<!-- ### some-invariant

\`\`\`yaml
kind: invariant
predicate: "true"
\`\`\`

Description of the claim. -->
`;
}

/**
 * `loom author <name>` — scaffolds a spec file from the grammar. AI-authoring
 * is explicitly upstream of this deterministic pipeline (§1); this command
 * stamps out the grammar skeleton only, no model calls.
 */
export function authorCommand(name: string, options: AuthorOptions): string {
  mkdirSync(options.out, { recursive: true });
  const path = join(options.out, `${name}.md`);
  writeFileSync(path, template(name), "utf8");
  return path;
}
