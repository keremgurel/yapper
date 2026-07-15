import { describe, expect, it } from "vitest";
import { waveformMedia, type TimelineMedia } from "@/lib/studio/timeline-media";
import type { AudioTrack } from "@/lib/studio/types";

function audio(fields: Partial<AudioTrack> & { id: string }): AudioTrack {
  return {
    name: "track",
    url: `blob:${fields.id}`,
    duration: 10,
    start: 0,
    muted: false,
    ...fields,
  };
}

const video: TimelineMedia[] = [
  { url: "blob:rec", duration: 30 },
  { url: "blob:broll", duration: 8 },
];

describe("waveformMedia", () => {
  it("keeps every video and appends each audio track's own file", () => {
    const out = waveformMedia(video, [
      audio({ id: "music", url: "blob:music", duration: 60 }),
    ]);
    expect(out).toEqual([
      { url: "blob:rec", duration: 30 },
      { url: "blob:broll", duration: 8 },
      { url: "blob:music", duration: 60 },
    ]);
  });

  it("does not decode a URL twice when an audio track reuses a video's URL", () => {
    const out = waveformMedia(video, [
      audio({ id: "same", url: "blob:rec", duration: 30 }),
    ]);
    expect(out.filter((m) => m.url === "blob:rec")).toHaveLength(1);
    expect(out).toHaveLength(2);
  });

  it("dedupes two audio tracks sharing one file", () => {
    const out = waveformMedia(
      [],
      [
        audio({ id: "a", url: "blob:m", duration: 20 }),
        audio({ id: "b", url: "blob:m", duration: 20 }),
      ],
    );
    expect(out).toHaveLength(1);
  });

  it("skips an audio track with no URL or no duration", () => {
    const out = waveformMedia(
      [],
      [
        audio({ id: "empty", url: "", duration: 10 }),
        audio({ id: "zero", url: "blob:z", duration: 0 }),
      ],
    );
    expect(out).toEqual([]);
  });
});
