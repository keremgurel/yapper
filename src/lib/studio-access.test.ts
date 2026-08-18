import { afterEach, describe, expect, it } from "vitest";

import {
  hasStudioAccess,
  isStudioAccessEnabled,
  isStudioPasswordCorrect,
  studioAccessToken,
} from "@/lib/studio-access";

const ORIGINAL = process.env.STUDIO_ACCESS_PASSWORD;

function setPassword(value: string | undefined) {
  if (value === undefined) delete process.env.STUDIO_ACCESS_PASSWORD;
  else process.env.STUDIO_ACCESS_PASSWORD = value;
}

afterEach(() => setPassword(ORIGINAL));

describe("studio access gate", () => {
  it("is disabled when no password is configured", async () => {
    setPassword(undefined);
    expect(isStudioAccessEnabled()).toBe(false);
    // Disabled means everything passes, so local dev is untouched.
    expect(await hasStudioAccess(undefined)).toBe(true);
    expect(await isStudioPasswordCorrect("anything")).toBe(true);
  });

  it("treats a whitespace-only password as unset", () => {
    setPassword("   ");
    expect(isStudioAccessEnabled()).toBe(false);
  });

  it("accepts a cookie minted from the current password", async () => {
    setPassword("open-sesame");
    expect(await hasStudioAccess(await studioAccessToken("open-sesame"))).toBe(
      true,
    );
  });

  it("rejects a missing or wrong cookie", async () => {
    setPassword("open-sesame");
    expect(await hasStudioAccess(undefined)).toBe(false);
    expect(await hasStudioAccess("")).toBe(false);
    expect(await hasStudioAccess("deadbeef")).toBe(false);
    expect(await hasStudioAccess(await studioAccessToken("other"))).toBe(false);
  });

  it("never puts the password in the cookie", async () => {
    setPassword("open-sesame");
    const token = await studioAccessToken("open-sesame");
    expect(token).not.toContain("open-sesame");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invalidates outstanding cookies when the password rotates", async () => {
    setPassword("first");
    const issued = await studioAccessToken("first");
    expect(await hasStudioAccess(issued)).toBe(true);

    setPassword("second");
    expect(await hasStudioAccess(issued)).toBe(false);
  });

  it("checks the submitted password exactly", async () => {
    setPassword("open-sesame");
    expect(await isStudioPasswordCorrect("open-sesame")).toBe(true);
    expect(await isStudioPasswordCorrect("open-sesam")).toBe(false);
    expect(await isStudioPasswordCorrect("open-sesame ")).toBe(false);
    expect(await isStudioPasswordCorrect("Open-Sesame")).toBe(false);
    expect(await isStudioPasswordCorrect("")).toBe(false);
  });
});
