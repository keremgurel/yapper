import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { enabledPublishPlatforms, isPlatformEnabled } from "./availability";
import { publishPlatforms } from "@/lib/db/schema";

describe("publishing rollout", () => {
  it("pauses Facebook without removing its stored type", () => {
    expect(publishPlatforms).toContain("facebook");
    expect(isPlatformEnabled("facebook")).toBe(false);
    expect(isPlatformEnabled("unknown")).toBe(false);
    expect(enabledPublishPlatforms).toEqual(["youtube", "tiktok", "instagram"]);
  });

  it("keeps the native platform picker aligned with the server", () => {
    const source = readFileSync(
      "native-macos/Sources/YapperNative/Studio/Surfaces/Connections/ConnectionModels.swift",
      "utf8",
    );
    const cases = source.match(
      /static let enabledCases: \[PublishPlatform\] = \[([^\]]+)\]/,
    )?.[1];
    expect(
      cases?.split(",").map((value) => value.trim().replace(/^\./, "")),
    ).toEqual(enabledPublishPlatforms);
  });
});
