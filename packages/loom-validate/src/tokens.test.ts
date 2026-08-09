import { describe, expect, it } from "vitest";
import { computeContentHash } from "loom-tokens";
import { checkTokensResolve, checkTokensLockStaleness } from "./tokens.js";
import { makeStyledFixture, makeTokensFixture } from "./fixtures.js";

describe("checkTokensResolve", () => {
  it("is ok when every token-ref and gapToken resolves", () => {
    const result = checkTokensResolve(makeStyledFixture(), makeTokensFixture());
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("reports an issue for a token-ref that doesn't resolve", () => {
    const fixture = makeStyledFixture();
    const ref = fixture.style[0];
    if (ref && ref.kind === "token-ref") ref.token = "color.surface.missing";
    const result = checkTokensResolve(fixture, makeTokensFixture());
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ nodeId: "widget/style/root-background", token: "color.surface.missing" }]);
  });

  it("reports an issue for a layout-intent gapToken that doesn't resolve", () => {
    const fixture = makeStyledFixture();
    const layout = fixture.style[1];
    if (layout && layout.kind === "layout-intent") layout.gapToken = "spacing.missing";
    const result = checkTokensResolve(fixture, makeTokensFixture());
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ nodeId: "widget/style/root-layout", token: "spacing.missing" }]);
  });
});

describe("checkTokensLockStaleness", () => {
  it("is not stale when the lock's hash matches the current tokens", () => {
    const tokens = makeTokensFixture();
    const lock = { tool: "figma", sourceRef: "file:abc", contentHash: computeContentHash(tokens), importedAt: "2026-08-09T00:00:00Z" };
    const result = checkTokensLockStaleness(lock, tokens);
    expect(result.stale).toBe(false);
  });

  it("is stale when the tokens have changed since the lock was written", () => {
    const tokens = makeTokensFixture();
    const lock = { tool: "figma", sourceRef: "file:abc", contentHash: "stale-hash", importedAt: "2026-08-09T00:00:00Z" };
    const result = checkTokensLockStaleness(lock, tokens);
    expect(result.stale).toBe(true);
    expect(result.lockedHash).toBe("stale-hash");
    expect(result.currentHash).toBe(computeContentHash(tokens));
  });
});
