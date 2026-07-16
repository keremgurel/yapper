import { describe, expect, it } from "vitest";
import { aacToAdts } from "@/lib/studio/audio/aac-adts";
import type { DemuxedAudio } from "@/lib/studio/audio/demux-audio";

const demux = (over: Partial<DemuxedAudio>): DemuxedAudio => ({
  codec: "mp4a.40.2",
  sampleRate: 44100,
  numberOfChannels: 2,
  chunks: [{ data: new Uint8Array([1, 2, 3]), timestamp: 0, duration: 0 }],
  ...over,
});

const chunk = (data: number[]) => ({
  data: new Uint8Array(data),
  timestamp: 0,
  duration: 0,
});

describe("aacToAdts header bytes", () => {
  it("emits a correct 7-byte ADTS header for 44.1kHz stereo AAC-LC", () => {
    const out = aacToAdts(
      demux({ chunks: [chunk([0xaa, 0xbb, 0xcc, 0xdd, 0xee])] }),
    );
    // frameLen = 7 + 5 = 12. profile 1 (AAC-LC), freqIdx 4 (44100), chanCfg 2.
    expect(out && Array.from(out)).toEqual([
      0xff, 0xf1, 0x50, 0x80, 0x01, 0x9f, 0xfc, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
    ]);
  });

  it("encodes the sample-rate index and channel config (48kHz mono)", () => {
    const out = aacToAdts(
      demux({
        sampleRate: 48000,
        numberOfChannels: 1,
        chunks: [chunk([1, 2, 3])],
      }),
    );
    // freqIdx 3 (48000) -> byte2 0x4c; chanCfg 1 -> byte3 0x40; frameLen 10.
    expect(out && Array.from(out.subarray(0, 7))).toEqual([
      0xff, 0xf1, 0x4c, 0x40, 0x01, 0x5f, 0xfc,
    ]);
  });

  it("splits the 13-bit frame length across bytes 3, 4 and 5", () => {
    // 4653 bytes of payload -> frameLen 4660 = 0x1234: high 2 bits = 2,
    // mid 8 = 0x46, low 3 = 4. A shift off by one here corrupts every frame.
    const out = aacToAdts(demux({ chunks: [chunk(new Array(4653).fill(0))] }));
    expect(out && Array.from(out.subarray(0, 7))).toEqual([
      0xff, 0xf1, 0x50, 0x82, 0x46, 0x9f, 0xfc,
    ]);
  });

  it("derives the ADTS profile from the AudioSpecificConfig object type", () => {
    // description[0] = 0x28 -> object type 5, so profile = 5 - 1 = 4 & 3 = 0.
    const out = aacToAdts(
      demux({
        description: new Uint8Array([0x28]),
        chunks: [chunk([0, 0, 0, 0, 0])],
      }),
    );
    expect(out?.[2]).toBe(0x10); // profile bits cleared vs 0x50 for AAC-LC
  });
});

describe("aacToAdts framing and guards", () => {
  it("concatenates one ADTS frame per chunk, back to back", () => {
    const out = aacToAdts(
      demux({ chunks: [chunk([0x01, 0x02]), chunk([0x03, 0x04, 0x05])] }),
    );
    expect(out?.length).toBe(7 + 2 + 7 + 3); // two headers + two payloads
    expect(out?.[9]).toBe(0xff); // second frame's syncword starts after frame 1
    expect(out?.[10]).toBe(0xf1);
    expect(out && Array.from(out.subarray(16))).toEqual([0x03, 0x04, 0x05]);
  });

  it("returns null for a non-AAC codec, unknown rate, or bad channel count", () => {
    expect(aacToAdts(demux({ codec: "opus" }))).toBeNull();
    expect(aacToAdts(demux({ sampleRate: 11000 }))).toBeNull();
    expect(aacToAdts(demux({ numberOfChannels: 0 }))).toBeNull();
    expect(aacToAdts(demux({ numberOfChannels: 8 }))).toBeNull();
  });
});
