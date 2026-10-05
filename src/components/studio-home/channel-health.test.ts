import { describe, expect, it } from "vitest";
import {
  allChannelsFailed,
  failedChannels,
  joinPlatformNames,
} from "./channel-health";
import type { ChannelResult } from "./use-channel-videos";

const ok = (platform: ChannelResult["platform"]): ChannelResult => ({
  platform,
  connected: true,
  videos: [],
});
const failed = (platform: ChannelResult["platform"]): ChannelResult => ({
  platform,
  connected: false,
  videos: [],
  error: "list_failed",
});
const off = (platform: ChannelResult["platform"]): ChannelResult => ({
  platform,
  connected: false,
  videos: [],
});

describe("channel health on Studio home", () => {
  it("names the channels that failed", () => {
    expect(
      failedChannels([
        ok("youtube"),
        ok("tiktok"),
        failed("instagram"),
        off("facebook"),
      ]),
    ).toEqual(["instagram"]);
    expect(failedChannels(null)).toEqual([]);
  });

  it("does not treat one failing channel as everything failing", () => {
    expect(
      allChannelsFailed([
        ok("youtube"),
        ok("tiktok"),
        failed("instagram"),
        off("facebook"),
      ]),
    ).toBe(false);
  });

  it("knows when every channel that should have data failed", () => {
    expect(
      allChannelsFailed([
        failed("youtube"),
        failed("instagram"),
        off("tiktok"),
      ]),
    ).toBe(true);
    expect(allChannelsFailed([off("youtube"), off("tiktok")])).toBe(false);
    expect(allChannelsFailed(null)).toBe(false);
  });

  it("joins names the way a sentence would", () => {
    expect(joinPlatformNames(["instagram"])).toBe("Instagram");
    expect(joinPlatformNames(["instagram", "tiktok"])).toBe(
      "Instagram and TikTok",
    );
    expect(joinPlatformNames(["instagram", "tiktok", "youtube"])).toBe(
      "Instagram, TikTok and YouTube",
    );
    expect(joinPlatformNames([])).toBe("");
  });
});
