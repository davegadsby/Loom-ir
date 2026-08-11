import type { ComponentNode, EmittedFile, ScenarioNode, Trigger } from "loom-ir";
import { pascalCase, machineSeedProp } from "loom-emit-core";

function isCheckboxPattern(component: ComponentNode): boolean {
  return component.a11y.some((n) => n.kind === "pattern-conformance" && n.pattern === "checkbox");
}

/** `(root as HTMLInputElement).checked ? "checked" : "unchecked"` vs. `root.getAttribute("data-state")` — the same branch `emitReact.ts`/`emitAngular.ts` already make for a checkbox-pattern root. */
function readStateLines(checkboxPattern: boolean): string[] {
  return checkboxPattern
    ? [`function readState(root: Element): string {`, `  return (root as HTMLInputElement).checked ? "checked" : "unchecked";`, `}`]
    : [`function readState(root: Element): string {`, `  return root.getAttribute("data-state") ?? "";`, `}`];
}

/**
 * `viaSpaceKey` substitutes a `{kind:"event", name:"click"}` step with a
 * focus + Space keypress instead — sound only for the checkbox pattern,
 * where a real `<input type="checkbox">`'s native Space-activation
 * dispatches the same `click` event a mouse would (§ `checkbox.md`'s own
 * "Keyboard" note). A `{kind:"key"}` step is already keyboard-driven and
 * unaffected by the flag.
 */
function fireEventLines(event: Trigger, scenarioId: string, index: number, viaSpaceKey: boolean): string[] {
  if (event.kind === "event" && event.name === "click") {
    return viaSpaceKey
      ? [`    (root as HTMLElement).focus();`, `    await userEvent.keyboard(" ");`]
      : [`    await userEvent.click(root);`];
  }
  if (event.kind === "key") return [`    fireEvent.keyDown(root, { key: ${JSON.stringify(event.key)} });`];
  throw new Error(
    `emitStorybookPlay: scenario '${scenarioId}' event #${index} has trigger kind '${event.kind}', which has no DOM mapping yet`
  );
}

/** `args: { [seedProp.name]: true }` when the scenario doesn't start at the machine's own initial state — the same structural link `machineSeedProp` already gives the emitters between "a prop that mirrors current state" and "which state that is". */
function seedArgsLine(scenario: ScenarioNode, component: ComponentNode): string | undefined {
  const initialState = component.states[0]?.name;
  if (scenario.from === initialState) return undefined;
  const seedProp = machineSeedProp(component);
  if (!seedProp || seedProp.name !== scenario.from) {
    throw new Error(
      `emitStorybookPlay: scenario '${scenario.id}' starts in '${scenario.from}', not the machine's initial state '${initialState}', and no seed prop mirrors '${scenario.from}' to start there`
    );
  }
  return `  args: { ${seedProp.name}: true },`;
}

function storyLines(scenario: ScenarioNode, component: ComponentNode, viaSpaceKey: boolean): string[] {
  const storyName = pascalCase(scenario.id.split("/").pop()!) + (viaSpaceKey ? "ViaSpaceKey" : "");
  const args = seedArgsLine(scenario, component);
  const driveComment = viaSpaceKey
    ? `    // Same scenario, driven via focus + Space instead of a click — sound only because a`
    : `    // Checked structurally at compile time by loom-ir's checkScenario; this drives the`;
  const driveComment2 = viaSpaceKey
    ? `    // native checkbox's Space-activation dispatches the same real 'click' event a mouse would.`
    : `    // real event sequence against a mounted, real-browser-rendered '${component.name}'.`;
  const lines = [
    `export const ${storyName}: Story = {`,
    ...(args ? [args] : []),
    `  play: async ({ canvasElement }) => {`,
    `    // [${scenario.id}] ${scenario.from} --${JSON.stringify(scenario.events)}--> ${scenario.to}`,
    driveComment,
    driveComment2,
    `    const root = canvasElement.querySelector('[data-loom-component="${component.name}"]');`,
    `    if (!root) throw new Error("scenario '${scenario.id}': no '${component.name}' root found in canvasElement");`,
    `    await expect(readState(root)).toBe(${JSON.stringify(scenario.from)});`,
    ...scenario.events.flatMap((event, i) => fireEventLines(event, scenario.id, i, viaSpaceKey)),
    `    await expect(readState(root)).toBe(${JSON.stringify(scenario.to)});`,
    `  },`,
    `};`,
    ``,
  ];
  return lines;
}

/**
 * Storybook CSF3 story generation per `ScenarioNode` (§8): one `.stories.tsx`
 * file per component (Storybook convention — a component's stories share one
 * file, one named export per story), each scenario claim becoming a named
 * story whose `play` function drives the real event sequence against a real,
 * browser-rendered instance and asserts the from/to state, matching the
 * `play({ canvasElement })` contract `@storybook/test-runner` actually
 * executes under a real headless Chromium — not a jsdom stand-in.
 *
 * Written by `examples/regenerate.ts` alongside the compiled component it
 * imports (`examples/generated/react/`), not into the generic tests output
 * directory — a relative `import { X } from "./X"` only resolves as a
 * sibling of `X.tsx`. React only for now; Angular would need a separate
 * `@storybook/angular` framework, out of scope here.
 */
export function emitStorybookPlay(component: ComponentNode): EmittedFile[] {
  const scenarios = component.claims.filter((c): c is ScenarioNode => c.kind === "scenario");
  if (scenarios.length === 0) return [];

  const componentName = pascalCase(component.name);
  const checkboxPattern = isCheckboxPattern(component);
  const usesKeyTrigger = scenarios.some((s) => s.events.some((e) => e.kind === "key"));

  const testImports = ["userEvent", "expect"];
  if (usesKeyTrigger) testImports.push("fireEvent");

  const lines = [
    `// GENERATED by loom-emit-tests (Storybook backend). Do not edit by hand.`,
    `import type { Meta, StoryObj } from "@storybook/react-vite";`,
    `import { ${testImports.join(", ")} } from "storybook/test";`,
    `import { ${componentName} } from "./${componentName}";`,
    ``,
    `const meta: Meta<typeof ${componentName}> = { component: ${componentName}, title: "Generated/${componentName}" };`,
    `export default meta;`,
    `type Story = StoryObj<typeof ${componentName}>;`,
    ``,
    ...readStateLines(checkboxPattern),
    ``,
    ...scenarios.flatMap((scenario) => [
      ...storyLines(scenario, component, false),
      ...(checkboxPattern ? storyLines(scenario, component, true) : []),
    ]),
  ];

  return [{ path: `${componentName}.stories.tsx`, contents: lines.join("\n") }];
}
