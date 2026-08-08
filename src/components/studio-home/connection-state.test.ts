import { describe, expect, it } from "vitest";
import { isChannelConnected } from "@/components/studio-home/connection-state";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";
import type { ConnectionSummary } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";

const channel = (
  platform: PublishPlatform,
  connected: boolean,
): ChannelResult => ({ platform, connected, videos: [] });

const connection = (
  platform: PublishPlatform,
  status: string,
): ConnectionSummary => ({
  platform,
  handle: null,
  externalAccountId: null,
  status,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("isChannelConnected", () => {
  it("is connected when the videos endpoint says so", () => {
    expect(isChannelConnected("youtube", [channel("youtube", true)], [])).toBe(
      true,
    );
  });

  /** OAuth finishing and channel history arriving are separate round trips.
   * Reading only the videos endpoint would show a channel the creator just
   * connected as disconnected until its history loaded. */
  it("is connected when only the stored connection row says so", () => {
    expect(
      isChannelConnected("youtube", null, [connection("youtube", "connected")]),
    ).toBe(true);
  });

  it("is not connected when the stored row is in any other state", () => {
    expect(
      isChannelConnected("youtube", [], [connection("youtube", "revoked")]),
    ).toBe(false);
  });

  it("does not confuse one platform for another", () => {
    expect(
      isChannelConnected(
        "tiktok",
        [channel("youtube", true)],
        [connection("youtube", "connected")],
      ),
    ).toBe(false);
  });

  it("is not connected while both sources are still loading", () => {
    expect(isChannelConnected("youtube", null, null)).toBe(false);
  });

  it("is not connected when the channel loaded but reports disconnected", () => {
    expect(isChannelConnected("youtube", [channel("youtube", false)], [])).toBe(
      false,
    );
  });
});
