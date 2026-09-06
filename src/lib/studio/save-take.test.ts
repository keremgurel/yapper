import { describe, expect, it, vi } from "vitest";
import { createTakeSaver } from "./save-take";

const blob = () => new Blob(["test take"], { type: "video/mp4" });
const allocation = () =>
  Response.json({ url: "https://storage.test/upload", key: "user/clip.mp4" });
const registration = () =>
  Response.json({ submission: { id: "submission-a" } });

describe("recorded take retry", () => {
  it("saves a standalone take with an atomic Library item and returns its navigation target", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(
        Response.json({
          submission: { id: "submission-a", contentItemId: "created-item" },
        }),
      );
    const link = vi.fn();
    const take = blob();
    const save = createTakeSaver({ request, link });
    expect(await save(null, take)).toBe("created-item");
    expect(await save(null, take)).toBe("created-item");
    expect(JSON.parse(request.mock.calls[2][1]?.body as string)).toMatchObject({
      createLibraryItem: true,
    });
    expect(link).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not claim a standalone take is saved when its Library target is absent", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(registration())
      .mockResolvedValueOnce(
        Response.json({
          submission: { id: "submission-a", contentItemId: "created-item" },
        }),
      );
    const save = createTakeSaver({ request, link: vi.fn() });
    const take = blob();
    await expect(save(null, take)).rejects.toThrow("failed");
    expect(await save(null, take)).toBe("created-item");
    expect(
      request.mock.calls.filter(([url]) => url === "/api/media/upload-url"),
    ).toHaveLength(1);
  });
  it("retries a lost registration response with the same uploaded object", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response())
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(registration());
    const link = vi.fn().mockResolvedValue(undefined);
    const save = createTakeSaver({ request, link });
    const take = blob();
    await expect(save("item-a", take)).rejects.toThrow("response lost");
    await save("item-a", take);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/media/upload-url",
      "https://storage.test/upload",
      "/api/submissions",
      "/api/submissions",
    ]);
    expect(request.mock.calls[2][1]?.body).toBe(request.mock.calls[3][1]?.body);
    expect(link).toHaveBeenCalledExactlyOnceWith("item-a", "submission-a");
  });

  it("retries only linking after registration, and ignores repeated successful saves", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(registration());
    const link = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const save = createTakeSaver({ request, link });
    const take = blob();
    await expect(save("item-a", take)).rejects.toThrow("offline");
    await save("item-a", take);
    await save("item-a", take);
    expect(request).toHaveBeenCalledTimes(3);
    expect(link).toHaveBeenCalledTimes(2);
  });

  it("deduplicates rapid saves and never retargets an in-flight take", async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const request = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(registration());
    const link = vi.fn().mockResolvedValue(undefined);
    const save = createTakeSaver({ request, link });
    const take = blob();
    const first = save("item-a", take);
    expect(save("item-a", take)).toBe(first);
    await expect(save("item-b", take)).rejects.toThrow("save_in_progress");
    resolve(allocation());
    await first;
    expect(link).toHaveBeenCalledExactlyOnceWith("item-a", "submission-a");
  });

  it.each([
    [402, "not_entitled", "locked"],
    [402, "storage_full", "storage_full"],
    [413, "media_too_large", "too_large"],
    [501, "storage_unavailable", "unavailable"],
  ])("reports %s %s accurately", async (status, error, expected) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error }, { status }));
    const link = vi.fn();
    await expect(
      createTakeSaver({ request, link })("item-a", blob()),
    ).rejects.toThrow(expected);
    expect(request).toHaveBeenCalledOnce();
    expect(link).not.toHaveBeenCalled();
  });

  it("reuses a valid upload allocation after a lost PUT response", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(registration());
    const save = createTakeSaver({
      request,
      link: vi.fn().mockResolvedValue(undefined),
    });
    const take = blob();
    await expect(save("item-a", take)).rejects.toThrow("offline");
    await save("item-a", take);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/media/upload-url",
      "https://storage.test/upload",
      "https://storage.test/upload",
      "/api/submissions",
    ]);
  });

  it("starts a new allocation when the previous upload signature expires", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(allocation())
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(registration());
    const save = createTakeSaver({
      request,
      link: vi.fn().mockResolvedValue(undefined),
    });
    const take = blob();
    await expect(save("item-a", take)).rejects.toThrow("failed");
    await save("item-a", take);
    expect(
      request.mock.calls.filter(([url]) => url === "/api/media/upload-url"),
    ).toHaveLength(2);
  });
});
