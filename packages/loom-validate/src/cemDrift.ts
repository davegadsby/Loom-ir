import type { ComponentNode } from "loom-ir";

export interface CemDriftResult {
  status: "not-checked";
  note: string;
}

/**
 * §11.3 is an explicit open design decision: does the custom-elements
 * manifest stay an input the IR is cross-checked against, or does it become
 * an output artifact the IR generates? Committing to either here would be
 * deciding it implicitly. This always reports `not-checked` until that
 * direction is chosen deliberately.
 */
export function checkCemDrift(_tree: ComponentNode, _cemPath?: string): CemDriftResult {
  return {
    status: "not-checked",
    note: "CEM's role (cross-check input vs. generated output) is an open design decision — architecture §11.3.",
  };
}
