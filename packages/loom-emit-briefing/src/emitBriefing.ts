import type { ComponentNode, EmittedFile, VerifyRoute } from "loom-ir";

function originText(origin: ComponentNode["origin"]): string {
  if (origin === "own") return "own";
  return `inherited from \`${origin.inheritedFrom}\`${origin.overridden ? " (overridden)" : ""}`;
}

function verifyText(verify: VerifyRoute | undefined): string {
  return verify ?? "—";
}

/**
 * Compiles a `ComponentNode` to a human-facing Markdown briefing (§9.1's
 * "keep non-assertable nodes" resolution): Prose nodes and a claims summary
 * come from the same tree as the code and tests, so the briefing can't drift
 * from either the way a hand-maintained doc would.
 *
 * Scoped thin for this pass (shape + a real minimal walk, not full prose
 * rendering of every node kind) — declarations/machine/a11y detail beyond
 * the claims table is a straightforward extension once a real consumer
 * needs it.
 */
export function emitBriefing(component: ComponentNode): EmittedFile[] {
  const lines: string[] = [`# ${component.name}`, ``];

  const intent = component.prose.find((p) => p.kind === "intent");
  if (intent) lines.push(`## Intent`, ``, intent.text, ``);

  const rationale = component.prose.find((p) => p.kind === "rationale");
  if (rationale) lines.push(`## Rationale`, ``, rationale.text, ``);

  if (component.claims.length > 0) {
    lines.push(`## Claims`, ``, `| Node | Kind | Verify | Origin |`, `|---|---|---|---|`);
    for (const claim of component.claims) {
      const verify = claim.kind === "unexpressible" ? "unverifiable" : verifyText(claim.verify);
      lines.push(`| \`${claim.id}\` | ${claim.kind} | ${verify} | ${originText(claim.origin)} |`);
    }
    lines.push(``);
  }

  if (component.a11y.length > 0) {
    lines.push(`## Accessibility`, ``, `| Node | Kind | Origin |`, `|---|---|---|`);
    for (const node of component.a11y) {
      lines.push(`| \`${node.id}\` | ${node.kind} | ${originText(node.origin)} |`);
    }
    lines.push(``);
  }

  return [{ path: `${component.name}.briefing.md`, contents: lines.join("\n") }];
}
