import { describe, expect, it } from "vitest";
import { captionsToSrt } from "@/lib/studio/export/srt";
import type { Caption, Clip } from "@/lib/studio/types";

const rec = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
});

const appended = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
  src: { url: "asset.mp4", kind: "video", name: "asset.mp4", duration: 10 },
});

const caption = (
  sourceStart: number,
  sourceEnd: number,
  text: string,
  extra: Partial<Caption> = {},
): Caption => ({
  id: `c-${sourceStart}`,
  text,
  sourceStart,
  sourceEnd,
  ...extra,
});

const whole = [rec("a", 0, 7200)];

describe("captionsToSrt", () => {
  it("numbers cues from 1 and formats HH:MM:SS,mmm", () => {
    const srt = captionsToSrt([caption(3661.5, 3662.25, "hello")], whole);
    expect(srt).toBe("1\n01:01:01,500 --> 01:01:02,250\nhello\n");
  });

  it("separates cues with a blank line", () => {
    const srt = captionsToSrt(
      [caption(0, 1, "one"), caption(2, 3, "two")],
      whole,
    );
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:01,000\none\n\n2\n00:00:02,000 --> 00:00:03,000\ntwo\n",
    );
  });

  it("times cues against the edited timeline, not the source", () => {
    const clips = [rec("a", 0, 3), rec("b", 6, 10)];
    const srt = captionsToSrt([caption(6, 7, "after the cut")], clips);
    expect(srt).toContain("00:00:03,000 --> 00:00:04,000");
  });

  it("skips a caption whose source range was cut away", () => {
    const clips = [rec("a", 0, 3), rec("b", 6, 10)];
    const srt = captionsToSrt(
      [caption(4, 5, "gone"), caption(1, 2, "kept")],
      clips,
    );
    expect(srt).not.toContain("gone");
    expect(srt).toContain("1\n00:00:01,000 --> 00:00:02,000\nkept\n");
  });

  it("skips a caption that only an appended clip's timebase would keep", () => {
    // The appended clip spans its own seconds 0..4. No recording second exists
    // on this timeline, so a caption anchored at recording second 1 is not in
    // the export.
    expect(
      captionsToSrt([caption(1, 2, "orphan")], [appended("b", 0, 4)]),
    ).toBe("");
  });

  it("shifts cues past an appended clip that plays before them", () => {
    const clips = [rec("a", 0, 3), appended("b", 0, 4), rec("c", 3, 10)];
    const srt = captionsToSrt([caption(3.5, 4.5, "later")], clips);
    expect(srt).toContain("00:00:07,500 --> 00:00:08,500");
  });

  it("skips empty and zero-length cues", () => {
    const srt = captionsToSrt(
      [caption(1, 1, "instant"), caption(2, 3, "   ")],
      whole,
    );
    expect(srt).toBe("");
  });

  it("lets a caption's own case override the global one", () => {
    const captions = [
      caption(0, 1, "shouty", { textCase: "upper" }),
      caption(2, 3, "Quiet"),
    ];
    const srt = captionsToSrt(captions, whole, "lower");
    expect(srt).toContain("SHOUTY");
    expect(srt).toContain("quiet");
  });

  it("orders cues by when they play, not by their source time", () => {
    // The recording's second half was dragged in front of its first half.
    const clips = [rec("b", 5, 10), rec("a", 0, 5)];
    const captions = [
      caption(1, 2, "spoken first"),
      caption(6, 7, "spoken second"),
    ];
    const srt = captionsToSrt(captions, clips);
    expect(srt).toBe(
      "1\n00:00:01,000 --> 00:00:02,000\nspoken second\n\n" +
        "2\n00:00:06,000 --> 00:00:07,000\nspoken first\n",
    );
  });
});
