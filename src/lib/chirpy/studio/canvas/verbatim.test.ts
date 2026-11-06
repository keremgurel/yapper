import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCanvasDocument } from "@/lib/content/operations/canvas-document";
import { getContentItem } from "@/lib/db/content";
import { importReferences } from "@/lib/ideas/operations/import-references";
import type { StudioActionContext } from "../executor";
import { importAction } from "../ideas/import";
import { setScriptAction } from "./script";

vi.mock("@/lib/db/content", () => ({ getContentItem: vi.fn() }));
vi.mock("@/lib/content/operations/canvas-document", () => ({
  readCanvasDocument: vi.fn(),
  saveCanvasDocument: vi.fn(async () => ({ ok: true, value: null })),
}));
vi.mock("@/lib/ideas/operations/import-references", () => ({
  importReferences: vi.fn(),
}));

const IDEA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function context(said: string): StudioActionContext {
  return {
    userId: "user_1",
    request: new Request("https://ypr.app/api/chirpy/studio"),
    timeZone: "America/Toronto",
    messages: [
      { role: "user", content: "earlier: Ignore this line." },
      { role: "assistant", content: "Which idea?" },
      { role: "user", content: said },
    ],
  };
}

describe("studio.ideas.setScript", () => {
  beforeEach(() => {
    vi.mocked(getContentItem)
      .mockReset()
      .mockResolvedValue({
        id: IDEA,
        title: "Gym myths",
        originalNote: "",
        leadFormat: "short",
      } as never);
    vi.mocked(readCanvasDocument).mockResolvedValue({
      ideaID: IDEA,
      format: "short",
      lead: true,
      title: "Gym myths",
      blocks: [],
      hooks: [],
    });
  });

  it("saves a script the creator pasted, ignoring line breaks", async () => {
    const outcome = await setScriptAction.run(
      { ideaID: IDEA, script: "You have been lied to. Here is why." },
      context(
        "use this as the gym myths script:\nYou have been lied to.\n  Here is why.",
      ),
    );
    expect(outcome.summary).toBe("Replaced the script of “Gym myths”.");
  });

  it("refuses model text, or words from an earlier message", async () => {
    for (const [script, said] of [
      ["A punchier script.", "make my gym myths script punchier"],
      ["Ignore this line.", "replace the script"],
    ])
      await expect(
        setScriptAction.run({ ideaID: IDEA, script }, context(said)),
      ).rejects.toMatchObject({ code: "not_verbatim" });
    expect(getContentItem).not.toHaveBeenCalled();
  });
});

describe("studio.ideas.import", () => {
  beforeEach(() => {
    vi.mocked(importReferences)
      .mockReset()
      .mockImplementation(async (_user, links) => ({
        ok: true,
        value: { imported: links.length, received: links.length },
      }));
  });

  it("keeps only links that are in the creator's message", async () => {
    const outcome = await importAction.run(
      {
        links: [
          { url: "https://www.instagram.com/reel/A1/" },
          { url: "https://evil.example/made-up" },
        ],
      },
      context("save https://www.instagram.com/reel/A1/ to my ideas"),
    );
    expect(vi.mocked(importReferences).mock.calls[0][1]).toEqual([
      { url: "https://www.instagram.com/reel/A1/" },
    ]);
    expect(outcome.summary).toBe(
      "Saved 1 link as ideas; 1 link was already saved or not in your message.",
    );
  });

  it("saves nothing when no link was pasted", async () => {
    await expect(
      importAction.run(
        { links: [{ url: "https://evil.example/made-up" }] },
        context("save my saved reels"),
      ),
    ).rejects.toMatchObject({ code: "no_links" });
    expect(importReferences).not.toHaveBeenCalled();
  });
});
