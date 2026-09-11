import { afterEach, describe, expect, it, vi } from "vitest";
import { postFacebookReel } from "./facebook";
import { PublishOutcomeUnknownError, createPublishWorkflow } from "./workflow";
afterEach(() => vi.unstubAllGlobals());
const input = () => ({
  token: "page-token",
  pageId: "123",
  videoUrl: "https://storage.example/video.mp4",
  caption: "Reviewed caption",
  onInitialized: vi.fn().mockResolvedValue(undefined),
});
const workflow = () => createPublishWorkflow(new AbortController().signal);
describe("Facebook Reel transfer", () => {
  it("saves the provider ID before upload and finishes the same Reel", async () => {
    const post = input();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          video_id: "456",
          upload_url: "https://rupload.facebook.com/video-upload/456",
        }),
      )
      .mockImplementationOnce(async () => {
        expect(post.onInitialized).toHaveBeenCalledWith("456");
        return Response.json({ success: true });
      })
      .mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await postFacebookReel(post, workflow())).toBe("456");
    const finish = fetch.mock.calls[2][1].body as URLSearchParams;
    expect(finish.get("video_id")).toBe("456");
    expect(finish.get("video_state")).toBe("PUBLISHED");
    expect(finish.get("description")).toBe("Reviewed caption");
  });
  it("does not send tokens to a foreign upload host", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        video_id: "456",
        upload_url: "https://attacker.example/upload",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(postFacebookReel(input(), workflow())).rejects.toThrow(
      "facebook_upload_url_invalid",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not upload if durable initialization could not be saved", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        video_id: "456",
        upload_url: "https://rupload.facebook.com/video-upload/456",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      postFacebookReel(
        {
          ...input(),
          onInitialized: vi.fn().mockRejectedValue(new Error("db_down")),
        },
        workflow(),
      ),
    ).rejects.toThrow("db_down");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps a transient finish failure uncertain", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          video_id: "456",
          upload_url: "https://rupload.facebook.com/video-upload/456",
        }),
      )
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 2,
              message: "Service unavailable",
              is_transient: true,
            },
          },
          { status: 500 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(postFacebookReel(input(), workflow())).rejects.toBeInstanceOf(
      PublishOutcomeUnknownError,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
