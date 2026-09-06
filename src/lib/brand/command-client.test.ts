import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBrandCommand } from "./command-client";
import {
  clearClientResources,
  readClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

const fetcher = vi.fn();
const kit = {
  colors: ["#000000"],
  logos: [
    {
      id: "logo",
      name: "My logo",
      url: "https://media.example/logo.png",
      isPrimary: true,
      mimeType: "image/png",
      mediaBytes: 123,
    },
  ],
};

beforeEach(() => {
  clearClientResources();
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe("Chirpy brand kit persistence", () => {
  it("writes through the brand API, preserves logos and updates the mounted kit", async () => {
    fetcher.mockResolvedValueOnce(Response.json(kit));
    fetcher.mockResolvedValueOnce(
      Response.json({ ...kit, colors: ["#000000", "#FFFFFF"] }),
    );
    const reply = await executeBrandCommand({
      kind: "update",
      operation: "add",
      colors: ["#FFFFFF"],
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/brand",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ brandColors: ["#000000", "#FFFFFF"] }),
      }),
    );
    expect(reply).toMatchObject({
      tone: "done",
      brandColors: ["#000000", "#FFFFFF"],
    });
    expect(readClientResource(STUDIO_RESOURCE_KEYS.brand)).toEqual({
      ...kit,
      colors: ["#000000", "#FFFFFF"],
    });
  });

  it("does not claim completion or replace shared data after a rejected write", async () => {
    fetcher.mockResolvedValueOnce(Response.json(kit));
    fetcher.mockResolvedValueOnce(
      Response.json({ error: "unavailable" }, { status: 503 }),
    );
    await expect(
      executeBrandCommand({
        kind: "update",
        operation: "set",
        colors: ["#FF0000"],
      }),
    ).rejects.toThrow("unavailable");
    expect(readClientResource(STUDIO_RESOURCE_KEYS.brand)).toBeNull();
  });

  it("reads the saved kit without writing when asked to show it", async () => {
    fetcher.mockResolvedValueOnce(Response.json(kit));
    const reply = await executeBrandCommand({ kind: "show" });
    expect(reply.brandColors).toEqual(kit.colors);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not make any request for ambiguous colors", async () => {
    await executeBrandCommand({ kind: "clarify", message: "Which shade?" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not write again when the requested palette is already saved", async () => {
    fetcher.mockResolvedValueOnce(Response.json(kit));
    await executeBrandCommand({
      kind: "update",
      operation: "add",
      colors: ["#000000"],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
