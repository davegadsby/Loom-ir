import { createRequire } from "node:module";
import type * as YamlNS from "js-yaml";

// js-yaml ships as CommonJS; loaded via createRequire to sidestep default-export
// ESM/CJS interop ambiguity under NodeNext (see the same pattern in loom-schema).
const require = createRequire(import.meta.url);
const yamlLoad = (require("js-yaml") as typeof YamlNS).load;

export interface RawNodeBlock {
  /** The `###` heading text — doubles as the node's structural slug (§5.5). */
  slug: string;
  yaml?: Record<string, unknown>;
  prose: string;
}

export interface RawSection {
  /** The `##` heading text, lowercased. */
  heading: string;
  blocks: RawNodeBlock[];
}

/** Sections whose body is plain prose with no `###` sub-blocks. */
const PROSE_ONLY_SECTIONS = new Set(["intent", "rationale"]);

const SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function slugify(headingText: string): string {
  const s = headingText.trim().toLowerCase();
  if (!SLUG_PATTERN.test(s)) {
    throw new Error(`heading '${headingText}' is not a valid slug (expected lowercase kebab-case)`);
  }
  return s;
}

/**
 * Hand-rolled line scanner for the spec body (post-frontmatter). Deliberately
 * not a full markdown parser: the grammar is disciplined by construction
 * (`##`/`###` headings, one fenced \`\`\`yaml block per node, prose is
 * everything else), so a small state machine is enough and it avoids pulling
 * in a markdown AST toolchain for four line patterns.
 */
export function parseSections(markdownBody: string): RawSection[] {
  const lines = markdownBody.split(/\r?\n/);
  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;
  let currentBlock: RawNodeBlock | null = null;
  let proseLines: string[] = [];
  let inYamlFence = false;
  let yamlLines: string[] = [];

  function flushProse(): void {
    if (currentBlock) {
      const text = proseLines.join("\n").trim();
      if (text.length > 0) {
        currentBlock.prose = currentBlock.prose ? `${currentBlock.prose}\n\n${text}` : text;
      }
    }
    proseLines = [];
  }

  for (const line of lines) {
    if (inYamlFence) {
      if (line.trim() === "```") {
        if (!currentBlock) throw new Error("fenced yaml block appears outside of any '###' node heading");
        if (currentBlock.yaml) throw new Error(`node '${currentBlock.slug}' has more than one fenced yaml block`);
        currentBlock.yaml = (yamlLoad(yamlLines.join("\n")) ?? {}) as Record<string, unknown>;
        inYamlFence = false;
        yamlLines = [];
      } else {
        yamlLines.push(line);
      }
      continue;
    }

    if (line.trim() === "```yaml") {
      flushProse();
      inYamlFence = true;
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      flushProse();
      currentBlock = null;
      currentSection = { heading: slugify(h2[1]!), blocks: [] };
      sections.push(currentSection);
      if (PROSE_ONLY_SECTIONS.has(currentSection.heading)) {
        currentBlock = { slug: currentSection.heading, prose: "" };
        currentSection.blocks.push(currentBlock);
      }
      continue;
    }

    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      flushProse();
      if (!currentSection) throw new Error(`'### ${h3[1]}' appears before any '##' section heading`);
      if (PROSE_ONLY_SECTIONS.has(currentSection.heading)) {
        throw new Error(`section '${currentSection.heading}' does not take '###' sub-headings`);
      }
      currentBlock = { slug: slugify(h3[1]!), prose: "" };
      currentSection.blocks.push(currentBlock);
      continue;
    }

    if (/^#\s+/.test(line)) continue; // top-level document title, ignored

    proseLines.push(line);
  }

  if (inYamlFence) throw new Error("unterminated fenced yaml block");
  flushProse();
  return sections;
}
