const MAX_QUEUE = 16;

export interface VideoEncoderSetup {
  codec: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
}

type OnVideoChunk = (
  chunk: EncodedVideoChunk,
  meta: EncodedVideoChunkMetadata | undefined,
) => void;

export interface VideoChunkEncoder {
  encodeFrame: (frame: VideoFrame, keyFrame: boolean) => Promise<void>;
  finish: () => Promise<void>;
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Wrap a VideoEncoder so the caller just feeds frames; applies backpressure so
 * the encode queue never runs away on long timelines. */
export function createVideoChunkEncoder(
  setup: VideoEncoderSetup,
  onChunk: OnVideoChunk,
): VideoChunkEncoder {
  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: onChunk,
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({
    codec: setup.codec,
    width: setup.width,
    height: setup.height,
    bitrate: setup.bitrate,
    framerate: setup.framerate,
    latencyMode: "quality",
  });

  const encodeFrame = async (frame: VideoFrame, keyFrame: boolean) => {
    while (encoder.encodeQueueSize > MAX_QUEUE && !encodeError) {
      await nextTick();
    }
    if (encodeError) {
      frame.close();
      throw encodeError;
    }
    encoder.encode(frame, { keyFrame });
    frame.close();
  };

  const finish = async () => {
    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;
  };

  return { encodeFrame, finish };
}
