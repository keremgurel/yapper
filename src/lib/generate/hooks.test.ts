import { describe, expect, it } from "vitest";
import { buildHooksMessages, parseHooks } from "@/lib/generate/hooks";
import { HOOK_PATTERNS } from "@/lib/content/hook-patterns";

const body = (hooks: unknown) => JSON.stringify({ hooks });

describe("parseHooks", () => {
  it("keeps the text, pattern and reasoning", () => {
    const out = parseHooks(
      body([
        { text: "Stop rehearsing.", pattern: "negation", why: "names it" },
      ]),
    );
    expect(out).toEqual([
      { text: "Stop rehearsing.", pattern: "negation", why: "names it" },
    ]);
  });

  /** A chip is only worth showing if it names something the creator can look
   * up. An archetype the library does not have explains nothing, so the tag is
   * dropped rather than stored. */
  it("drops a pattern the library does not know", () => {
    const out = parseHooks(body([{ text: "A line.", pattern: "vibes" }]));
    expect(out[0].pattern).toBeNull();
    expect(out[0].text).toBe("A line.");
  });

  it("trusts the requested pattern over a mislabelled one", () => {
    // The model was told to write only this archetype, so its own label is not
    // the authority on what it produced.
    const out = parseHooks(
      body([{ text: "A line.", pattern: "curiosity" }]),
      "stakes",
    );
    expect(out[0].pattern).toBe("stakes");
  });

  it("drops entries with no usable text", () => {
    const out = parseHooks(
      body([{ text: "   " }, { pattern: "stakes" }, { text: "Real." }]),
    );
    expect(out).toEqual([{ text: "Real.", pattern: null, why: null }]);
  });

  it("normalizes a blank reason to null", () => {
    const out = parseHooks(body([{ text: "A line.", why: "  " }]));
    expect(out[0].why).toBeNull();
  });

  it("throws hooks_empty when nothing usable came back", () => {
    // The route charges only when this returns, so an empty result must throw.
    expect(() => parseHooks(body([]))).toThrow("hooks_empty");
    expect(() => parseHooks("{}")).toThrow("hooks_empty");
  });

  it("throws hooks_unparseable on malformed output", () => {
    expect(() => parseHooks("not json")).toThrow("hooks_unparseable");
    expect(() => parseHooks("{ broken")).toThrow("hooks_unparseable");
  });
});

describe("buildHooksMessages", () => {
  it("offers the whole menu and asks for variety by default", () => {
    const { system } = buildHooksMessages({ title: "T" });
    HOOK_PATTERNS.forEach((p) => expect(system).toContain(p.id));
    expect(system).toContain("DIFFERENT pattern");
  });

  it("narrows the menu to one pattern when asked", () => {
    const { system } = buildHooksMessages({ title: "T", patternId: "stakes" });
    expect(system).toContain("stakes");
    expect(system).toContain('must use the "stakes" pattern');
    // The other archetypes are not sent at all: a narrowed request should cost
    // less than the full menu, not the same.
    expect(system).not.toContain("cold-open");
  });

  it("puts the creator's own words in the prompt ahead of the body", () => {
    const { user } = buildHooksMessages({
      title: "T",
      originalNote: "my angle",
      blocks: [{ label: "Key points", kind: "bullets", items: ["a"] }],
    });
    expect(user.indexOf("my angle")).toBeLessThan(user.indexOf("Key points"));
  });

  it("skips blocks with no content", () => {
    const { user } = buildHooksMessages({
      title: "T",
      blocks: [{ label: "Empty", kind: "paragraph", text: "  " }],
    });
    expect(user).not.toContain("Empty");
  });
});
