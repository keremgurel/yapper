import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readScheduleInput,
  scheduleDate,
  scheduleTimezone,
} from "./schedule-input";

const now = Date.parse("2026-09-05T12:00:00Z");
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => vi.restoreAllMocks());
const base = () => ({
  requestKey: randomUUID(),
  scheduledFor: "2026-09-05T18:00:00+03:00",
  timezone: "Europe/Istanbul",
  targets: [
    {
      platform: "youtube",
      expectedAccountId: "account",
      input: {
        mediaKey: "user_test/video.mp4",
        title: "Reviewed title",
        privacyStatus: "public",
      },
    },
  ],
});
const request = (body: unknown) =>
  new Request("https://test/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("scheduling input", () => {
  it("stores an absolute instant plus the chosen display time zone", async () => {
    const parsed = await readScheduleInput(request(base()));
    expect(parsed.scheduledFor.toISOString()).toBe("2026-09-05T15:00:00.000Z");
    expect(parsed.timezone).toBe("Europe/Istanbul");
    expect(parsed.targets[0].input.mediaKey).toBe("user_test/video.mp4");
  });
  it.each([
    "2026-09-05T12:00:20Z",
    "2026-09-05T18:00:00",
    "2027-01-01T00:00:00Z",
    "bad",
    null,
  ])("rejects ambiguous, past or distant dates: %s", (value) => {
    expect(() => scheduleDate(value)).toThrow("invalid_body");
  });
  it("accepts explicit offsets through a repeated daylight-saving hour", () => {
    expect(scheduleDate("2026-11-01T01:30:00-04:00").getTime()).not.toBe(
      scheduleDate("2026-11-01T01:30:00-05:00").getTime(),
    );
    expect(() => scheduleTimezone("invented/zone")).toThrow("invalid_body");
  });
  it("can parse a previously saved request after its scheduled time for replay", async () => {
    const body = { ...base(), scheduledFor: "2026-09-01T00:00:00Z" };
    await expect(readScheduleInput(request(body))).rejects.toThrow(
      "invalid_body",
    );
    expect(
      (
        await readScheduleInput(request(body), false)
      ).scheduledFor.toISOString(),
    ).toBe(body.scheduledFor.replace("Z", ".000Z"));
  });
  it("rejects duplicate source/destination pairs but accepts independent destinations", async () => {
    const body = base();
    await expect(
      readScheduleInput(
        request({ ...body, targets: [...body.targets, ...body.targets] }),
      ),
    ).rejects.toThrow("invalid_body");
    const result = await readScheduleInput(
      request({
        ...body,
        targets: [
          ...body.targets,
          {
            platform: "instagram",
            expectedAccountId: "instagram-account",
            input: { mediaKey: "user_test/video.mp4", caption: "Caption" },
          },
        ],
      }),
    );
    expect(result.targets).toHaveLength(2);
  });
  it.each([
    {
      mediaKey: "user_test/video.mp4",
      submissionId: randomUUID(),
      title: "Title",
    },
    { title: "No source" },
    { submissionId: "not-a-uuid", title: "Title" },
    { mediaKey: "user_test/video.mp4", title: "" },
    { mediaKey: "user_test/video.mp4", title: "a".repeat(101) },
  ])("rejects a source or copy that cannot be published", async (input) => {
    await expect(
      readScheduleInput(
        request({ ...base(), targets: [{ platform: "youtube", input }] }),
      ),
    ).rejects.toThrow();
  });
  it("rejects unsupported platforms and oversized selections", async () => {
    const body = base();
    await expect(
      readScheduleInput(
        request({
          ...body,
          targets: [{ platform: "facebook", input: body.targets[0].input }],
        }),
      ),
    ).rejects.toThrow();
    await expect(
      readScheduleInput(
        request({ ...body, targets: Array(21).fill(body.targets[0]) }),
      ),
    ).rejects.toThrow();
  });
});
