import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeAudioBuffer } from "@/lib/studio/export/encode-audio";

afterEach(() => vi.unstubAllGlobals());

describe("encodeAudioBuffer", () => {
  it("does not forward Safari's decoder metadata to the MP4 muxer", async () => {
    class FakeAudioData {
      close() {}
    }
    class FakeAudioEncoder {
      constructor(
        private readonly init: {
          output: (
            chunk: EncodedAudioChunk,
            metadata?: EncodedAudioChunkMetadata,
          ) => void;
        },
      ) {}

      configure() {}

      encode() {
        this.init.output({} as EncodedAudioChunk, {
          decoderConfig: {
            codec: "mp4a.40.2",
            sampleRate: 22_050,
            numberOfChannels: 0,
            description: new Uint8Array([0, 0]),
          },
        });
      }

      async flush() {}

      close() {}
    }

    vi.stubGlobal("AudioData", FakeAudioData);
    vi.stubGlobal("AudioEncoder", FakeAudioEncoder);
    const onChunk = vi.fn();
    const channel = new Float32Array(4);
    const buffer = {
      sampleRate: 48_000,
      numberOfChannels: 2,
      length: channel.length,
      getChannelData: () => channel,
    } as unknown as AudioBuffer;

    await encodeAudioBuffer(buffer, onChunk);

    expect(onChunk).toHaveBeenCalledOnce();
    expect(onChunk.mock.calls[0]).toHaveLength(1);
  });
});
