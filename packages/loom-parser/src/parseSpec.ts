import { createRequire } from "node:module";
import type matterFn from "gray-matter";
import { validateFrontmatter, validateNodeBlock } from "loom-schema";
import {
  computeNodeId,
  checkScenario,
  checkComposition,
  type A11yNode,
  type ClaimNode,
  type ComponentNode,
  type CompositionNode,
  type DeclarationNode,
  type EventNode,
  type GuardNode,
  type PropValue,
  type ProseNode,
  type RuleNode,
  type StateNode,
  type StyleNode,
  type TransitionNode,
  type Trigger,
  type UsesNode,
  type VerifyRoute,
} from "loom-ir";
import { parseDomain, parseExpr } from "loom-expr";
import { parseSections, type RawNodeBlock } from "./markdown.js";
import { parseTypeText } from "./typeText.js";
import { flattenInheritance } from "./inheritance.js";

// gray-matter ships as CommonJS; loaded via createRequire to sidestep default-export
// ESM/CJS interop ambiguity under NodeNext (see the same pattern in loom-schema).
const require = createRequire(import.meta.url);
const matter = require("gray-matter") as typeof matterFn;

export interface ParseSpecOptions {
  /** Resolves a base spec named in `extends` to its already-parsed (and itself already-flattened) tree. */
  resolveBase?: (ref: string) => ComponentNode;
  /**
   * Resolves a `uses.component` ref to its already-parsed (and, if it has its
   * own `extends`, already-flattened) tree. Never flattened into the
   * referencer — kept as a distinct nested tree (see loom-ir's composition.ts
   * and both component emitters). A distinct option from `resolveBase` even
   * though callers typically wire the same underlying resolver to both, so
   * this file stays honest about which refs get flattened vs. embedded whole.
   */
  resolveComponent?: (ref: string) => ComponentNode;
}

export function parseSpec(source: string, options: ParseSpecOptions = {}): ComponentNode {
  const { data, content } = matter(source);
  const frontmatter = validateFrontmatter(data);
  const componentSlug = frontmatter.name;
  const sections = parseSections(content);
  const byHeading = new Map(sections.map((s) => [s.heading, s] as const));

  const prose: ProseNode[] = [];
  const intentSection = byHeading.get("intent");
  if (intentSection) {
    const block = intentSection.blocks[0]!;
    prose.push({
      id: computeNodeId(componentSlug, "prose", block.slug),
      kind: "intent",
      origin: "own",
      assertable: false,
      text: block.prose,
    });
  }
  const rationaleSection = byHeading.get("rationale");
  if (rationaleSection) {
    const block = rationaleSection.blocks[0]!;
    prose.push({
      id: computeNodeId(componentSlug, "prose", block.slug),
      kind: "rationale",
      origin: "own",
      assertable: false,
      text: block.prose,
    });
  }

  const declarations: DeclarationNode[] = (byHeading.get("declarations")?.blocks ?? []).map((block) =>
    buildDeclarationNode(componentSlug, block)
  );

  const states: StateNode[] = [];
  const transitions: TransitionNode[] = [];
  const guards: GuardNode[] = [];
  const rules: RuleNode[] = [];
  for (const block of byHeading.get("machine")?.blocks ?? []) {
    const node = buildMachineNode(componentSlug, block);
    if (node.kind === "state") states.push(node);
    else if (node.kind === "transition") transitions.push(node);
    else if (node.kind === "guard") guards.push(node);
    else rules.push(node);
  }

  const claims: ClaimNode[] = (byHeading.get("claims")?.blocks ?? []).map((block) =>
    buildClaimNode(componentSlug, block)
  );

  const a11y: A11yNode[] = (byHeading.get("a11y")?.blocks ?? []).map((block) => buildA11yNode(componentSlug, block));

  const style: StyleNode[] = (byHeading.get("style")?.blocks ?? []).map((block) => buildStyleNode(componentSlug, block));

  const composition: CompositionNode[] = (byHeading.get("composition")?.blocks ?? []).map((block) =>
    buildCompositionNode(componentSlug, block, options)
  );

  let component: ComponentNode = {
    id: componentSlug,
    kind: "component",
    origin: "own",
    assertable: false,
    name: componentSlug,
    extends: frontmatter.extends ?? [],
    declarations,
    states,
    transitions,
    guards,
    rules,
    claims,
    a11y,
    style,
    composition,
    prose,
  };

  if (component.extends.length > 0) {
    if (!options.resolveBase) {
      throw new Error(
        `spec '${componentSlug}' extends [${component.extends.join(", ")}] but no resolveBase was provided`
      );
    }
    const bases = component.extends.map((ref) => options.resolveBase!(ref));
    const basesWithComposition = component.extends.filter((ref, i) => bases[i]!.composition.length > 0);
    if (basesWithComposition.length > 0) {
      throw new Error(
        `spec '${componentSlug}' extends [${basesWithComposition.join(", ")}] which declare their own Composition — extends+composition on a base is unsupported (flattenInheritance never merges the composition field, so a base's composition nodes would be silently discarded)`
      );
    }
    component = flattenInheritance(component, bases);
  }

  if (component.composition.length > 0 && frontmatter.kind !== "composite") {
    throw new Error(
      `spec '${componentSlug}' has a Composition section but frontmatter.kind is '${frontmatter.kind}', expected 'composite'`
    );
  }

  for (const claim of component.claims) {
    if (claim.kind === "scenario") checkScenario(claim, component.transitions);
  }

  checkComposition(component);

  return component;
}

function requireYaml(block: RawNodeBlock): Record<string, unknown> {
  if (!block.yaml) throw new Error(`node '${block.slug}' is missing its fenced \`\`\`yaml block`);
  return validateNodeBlock(block.yaml);
}

function asVerify(value: unknown, fallback: VerifyRoute): VerifyRoute {
  return (value as VerifyRoute | undefined) ?? fallback;
}

function buildDeclarationNode(componentSlug: string, block: RawNodeBlock): DeclarationNode {
  const yaml = requireYaml(block);
  const id = computeNodeId(componentSlug, "declarations", block.slug);
  const envelope = { id, origin: "own" as const, assertable: false as const };
  switch (yaml.kind) {
    case "prop":
      return {
        ...envelope,
        kind: "prop",
        name: block.slug,
        valueType: parseTypeText(yaml.type as string),
        defaultValue: yaml.default as never,
      };
    case "event":
      return {
        ...envelope,
        kind: "event",
        name: block.slug,
        payloadType: parseTypeText(yaml.payloadType as string),
        firesWhen: yaml.firesWhen as EventNode["firesWhen"],
        trigger: yaml.trigger as EventNode["trigger"],
      };
    case "slot":
      return { ...envelope, kind: "slot", name: block.slug };
    case "field":
      return {
        ...envelope,
        kind: "field",
        name: block.slug,
        secret: yaml.secret as boolean | undefined,
        initialValue: yaml.initialValue as string | undefined,
        validate: yaml.validate ? parseExpr(yaml.validate as string) : undefined,
        invalidMessage: yaml.invalidMessage as string | undefined,
      };
    case "derived":
      return {
        ...envelope,
        kind: "derived",
        name: block.slug,
        valueType: parseTypeText(yaml.type as string),
        expr: parseExpr(yaml.expr as string),
      };
    case "resource":
      return {
        ...envelope,
        kind: "resource",
        name: block.slug,
        dataType: parseTypeText(yaml.dataType as string),
      };
    case "selection":
      return {
        ...envelope,
        kind: "selection",
        name: block.slug,
        valueType: parseTypeText(yaml.type as string),
        initialValue: yaml.initialValue as never,
      };
    case "method": {
      const rawParams = (yaml.params as Array<{ name: string; type: string }> | undefined) ?? [];
      return {
        ...envelope,
        kind: "method",
        name: block.slug,
        params: rawParams.map((p) => ({ name: p.name, type: parseTypeText(p.type) })),
        returnType: parseTypeText(yaml.returnType as string),
      };
    }
    default:
      throw new Error(`node '${block.slug}' in Declarations has unexpected kind '${String(yaml.kind)}'`);
  }
}

function buildMachineNode(
  componentSlug: string,
  block: RawNodeBlock
): StateNode | TransitionNode | GuardNode | RuleNode {
  const yaml = requireYaml(block);
  const id = computeNodeId(componentSlug, "machine", block.slug);
  const envelope = { id, origin: "own" as const, assertable: false as const };
  switch (yaml.kind) {
    case "state":
      return { ...envelope, kind: "state", name: block.slug, flags: (yaml.flags as Record<string, boolean>) ?? {} };
    case "transition":
      return {
        ...envelope,
        kind: "transition",
        name: block.slug,
        from: yaml.from as string,
        to: yaml.to as string,
        trigger: yaml.trigger as Trigger,
        guard: yaml.guard ? parseExpr(yaml.guard as string) : undefined,
      };
    case "guard":
      return { ...envelope, kind: "guard", name: block.slug, predicate: parseExpr(yaml.predicate as string) };
    case "rule":
      return {
        ...envelope,
        kind: "rule",
        name: block.slug,
        condition: parseExpr(yaml.condition as string),
        outcome: parseExpr(yaml.outcome as string),
      };
    default:
      throw new Error(`node '${block.slug}' in Machine has unexpected kind '${String(yaml.kind)}'`);
  }
}

function buildClaimNode(componentSlug: string, block: RawNodeBlock): ClaimNode {
  const id = computeNodeId(componentSlug, "claims", block.slug);
  const envelope = { id, origin: "own" as const, assertable: true as const };

  if (!block.yaml) {
    // Only 'unexpressible' claims may omit the yaml block: prose-only by design (§6.6).
    return { ...envelope, kind: "unexpressible", claim: block.prose };
  }

  const yaml = requireYaml(block);
  switch (yaml.kind) {
    case "invariant":
      return {
        ...envelope,
        kind: "invariant",
        verify: asVerify(yaml.verify, "unit"),
        predicate: parseExpr(yaml.predicate as string),
      };
    case "property": {
      const ident = yaml.ident as string;
      return {
        ...envelope,
        kind: "property",
        verify: asVerify(yaml.verify, "unit"),
        ident,
        domain: parseDomain(yaml.domain as string, ident),
        predicate: parseExpr(yaml.predicate as string),
      };
    }
    case "scenario":
      return {
        ...envelope,
        kind: "scenario",
        verify: asVerify(yaml.verify, "interaction"),
        from: yaml.from as string,
        events: yaml.events as Trigger[],
        to: yaml.to as string,
      };
    case "unexpressible":
      return { ...envelope, kind: "unexpressible", claim: block.prose };
    default:
      throw new Error(`node '${block.slug}' in Claims has unexpected kind '${String(yaml.kind)}'`);
  }
}

function buildA11yNode(componentSlug: string, block: RawNodeBlock): A11yNode {
  const yaml = requireYaml(block);
  const id = computeNodeId(componentSlug, "a11y", block.slug);
  switch (yaml.kind) {
    case "pattern-conformance":
      return {
        id,
        origin: "own",
        assertable: true,
        kind: "pattern-conformance",
        verify: asVerify(yaml.verify, "a11y"),
        pattern: yaml.pattern as string,
      };
    case "delta":
      return { id, origin: "own", assertable: true, kind: "delta", verify: "a11y", description: block.prose };
    case "aria-relation":
      return {
        id,
        origin: "own",
        assertable: false,
        kind: "aria-relation",
        relation: yaml.relation as string,
        description: block.prose,
      };
    default:
      throw new Error(`node '${block.slug}' in A11y has unexpected kind '${String(yaml.kind)}'`);
  }
}

function buildStyleNode(componentSlug: string, block: RawNodeBlock): StyleNode {
  const yaml = requireYaml(block);
  const id = computeNodeId(componentSlug, "style", block.slug);
  switch (yaml.kind) {
    case "token-ref":
      return {
        id,
        origin: "own",
        assertable: true,
        kind: "token-ref",
        part: yaml.part as string,
        property: yaml.property as string,
        token: yaml.token as string,
      };
    case "layout-intent":
      return {
        id,
        origin: "own",
        assertable: true,
        kind: "layout-intent",
        part: yaml.part as string,
        display: yaml.display as "flex" | "grid",
        direction: yaml.direction as "row" | "column" | undefined,
        gapToken: yaml.gapToken as string | undefined,
        align: yaml.align as string | undefined,
        justify: yaml.justify as string | undefined,
      };
    case "visual-conformance":
      return {
        id,
        origin: "own",
        assertable: true,
        kind: "visual-conformance",
        verify: asVerify(yaml.verify, "visual"),
        reference: yaml.reference as string,
      };
    default:
      throw new Error(`node '${block.slug}' in Style has unexpected kind '${String(yaml.kind)}'`);
  }
}

/** A raw YAML prop value is either a literal, or `{ expr: <expression text> }` — the latter's text needs `parseExpr`, same as any other expression-language field. */
function parsePropsYaml(raw: Record<string, unknown> | undefined): UsesNode["props"] {
  if (!raw) return undefined;
  const result: NonNullable<UsesNode["props"]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value) && "expr" in value) {
      result[key] = { expr: parseExpr((value as { expr: string }).expr) };
    } else {
      result[key] = value as PropValue;
    }
  }
  return result;
}

function buildCompositionNode(componentSlug: string, block: RawNodeBlock, options: ParseSpecOptions): UsesNode {
  const yaml = requireYaml(block);
  if (yaml.kind !== "uses") {
    throw new Error(`node '${block.slug}' in Composition has unexpected kind '${String(yaml.kind)}'`);
  }
  const ref = yaml.component as string;
  if (!options.resolveComponent) {
    throw new Error(`spec '${componentSlug}' has a Composition node referencing '${ref}' but no resolveComponent was provided`);
  }
  return {
    id: computeNodeId(componentSlug, "composition", block.slug),
    origin: "own",
    assertable: false,
    kind: "uses",
    name: block.slug,
    component: ref,
    resolvedComponent: options.resolveComponent(ref),
    root: yaml.root as boolean | undefined,
    props: parsePropsYaml(yaml.props as Record<string, unknown> | undefined),
    slotContent: yaml.slotContent as UsesNode["slotContent"],
    on: yaml.on as UsesNode["on"],
    visibleWhen: yaml.visibleWhen as string | undefined,
  };
}
