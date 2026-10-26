import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => [initial, vi.fn()],
}));
const { createContent, prepareUploadedCaption } = vi.hoisted(() => ({
  createContent: vi.fn(),
  prepareUploadedCaption: vi.fn(),
}));
vi.mock("@/lib/content/client", () => ({
  createContent,
  patchContent: vi.fn(),
}));
vi.mock("@/components/publish/captions/prepare-caption-subject", () => ({
  prepareUploadedCaption,
}));
import { useAddVideo } from "./use-add-video";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("attaching an original through Poster uploads", () => {
  it("keeps the selected post title and caption, registers the owned file, then opens the resulting item", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          url: "https://storage.example/upload",
          key: "owned/master.mp4",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ submission: { id: "submission-1" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        upload = {};
        status = 200;
        onload = () => {};
        open() {}
        setRequestHeader() {}
        send() {
          this.onload();
        }
      },
    );
    const linked = {
      id: "item-1",
      submissionId: "submission-1",
      title: "Original title",
    };
    createContent.mockResolvedValue(linked);
    prepareUploadedCaption.mockResolvedValue(linked);
    const added = vi.fn();
    await useAddVideo(added).add(
      new File(["video"], "different-filename.mp4", { type: "video/mp4" }),
      { title: "Original title", caption: "Original caption\n#tag" },
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      mediaKey: "owned/master.mp4",
      title: "Original title",
    });
    expect(createContent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Original title",
        originalNote: "Original caption\n#tag",
        submissionId: "submission-1",
        sourceUrl: "yapper://poster-upload",
      }),
    );
    expect(added).toHaveBeenCalledWith(linked);
  });
  it("never replaces the selected video or creates a library row when upload preflight rejects access", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "not_entitled" }, { status: 402 }),
        ),
    );
    const added = vi.fn();
    await useAddVideo(added).add(
      new File(["video"], "original.mp4", { type: "video/mp4" }),
      { title: "Selected post" },
    );
    expect(added).not.toHaveBeenCalled();
    expect(createContent).not.toHaveBeenCalled();
  });
});
