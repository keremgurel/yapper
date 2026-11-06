import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockFrom } from "@/lib/content/canvas-doc";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { saveContentVersion } from "@/lib/db/content-versions";
import { saveCanvasDocument, type CanvasDocument } from "./canvas-document";

vi.mock("@/lib/content/operations/update-item", () => ({
  updateOwnContentItem: vi.fn(),
}));
vi.mock("@/lib/db/content-versions", () => ({
  listContentVersions: vi.fn(),
  saveContentVersion: vi.fn(),
}));

const script = blockFrom({ label: "Script", kind: "script", text: "Old." });
const lead: CanvasDocument = {
  ideaID: "idea",
  format: "short",
  lead: true,
  title: "Gym myths",
  blocks: [script],
  hooks: ["Stop doing this"],
};

describe("saveCanvasDocument", () => {
  beforeEach(() => {
    vi.mocked(updateOwnContentItem)
      .mockReset()
      .mockResolvedValue({ ok: true, value: {} as never });
    vi.mocked(saveContentVersion)
      .mockReset()
      .mockResolvedValue({} as never);
  });

  it("writes only what changed on the lead, with the mirrored script", async () => {
    await saveCanvasDocument("user_1", lead, {
      ...lead,
      blocks: [{ ...script, text: "New." }],
    });
    expect(updateOwnContentItem).toHaveBeenCalledWith(
      "user_1",
      "idea",
      {
        blocks: [{ label: "Script", kind: "script", text: "New." }],
        script: "New.",
      },
      expect.any(Function),
    );

    vi.mocked(updateOwnContentItem).mockClear();
    await saveCanvasDocument("user_1", lead, lead);
    expect(updateOwnContentItem).not.toHaveBeenCalled();
  });

  it("saves another version on its own row and a title on the idea", async () => {
    const long = { ...lead, format: "long" as const, lead: false };
    await saveCanvasDocument("user_1", long, {
      ...long,
      title: "Gym myths, the long cut",
      hooks: ["A", "B"],
    });
    expect(saveContentVersion).toHaveBeenCalledWith(
      "user_1",
      "idea",
      "long",
      {
        hooks: [
          { text: "A", pattern: null, why: null },
          { text: "B", pattern: null, why: null },
        ],
        title: "A",
      },
      expect.any(Function),
    );
    expect(updateOwnContentItem).toHaveBeenCalledWith(
      "user_1",
      "idea",
      { title: "Gym myths, the long cut" },
      expect.any(Function),
    );
  });

  it("writes nothing when the stored copy changed since it was read", async () => {
    vi.mocked(updateOwnContentItem).mockImplementation(
      async (_user, _id, body, reconcile) => {
        // The row as stored now: the creator typed while the writer worked.
        reconcile!(
          {
            title: "Gym myths",
            hooks: [{ text: "Stop doing this", pattern: null, why: null }],
            blocks: [{ label: "Script", kind: "script", text: "Typed." }],
            script: "Typed.",
          } as never,
          body as never,
        );
        return { ok: true, value: {} as never };
      },
    );
    const saved = await saveCanvasDocument("user_1", lead, {
      ...lead,
      blocks: [{ ...script, text: "New." }],
    });
    expect(saved).toMatchObject({
      ok: false,
      status: 409,
      error: "changed_while_working",
    });
  });
});
