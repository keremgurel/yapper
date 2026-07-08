import { createFile, MP4BoxBuffer, type Sample, type Track } from "mp4box";

/**
 * The compressed audio track pulled out of a media file, ready to hand to a
 * WebCodecs AudioDecoder. We demux with mp4box instead of leaning on Web Audio's
 * decodeAudioData because the latter silently drops chunks of audio on files
 * with several tracks (camera clips carry video + audio + gyro/timecode data +
 * a thumbnail), which corrupts the transcript. mp4box reads the audio samples
 * exactly, in order, with none missing.
 */
export interface DemuxedAudio {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: Uint8Array; // AAC AudioSpecificConfig (needed to decode)
  chunks: { data: Uint8Array; timestamp: number; duration: number }[];
}

/**
 * Pull the AAC AudioSpecificConfig out of the esds descriptor tree. It lives in
 * the DecoderSpecificInfo descriptor (MPEG-4 tag 5), nested under the
 * DecoderConfigDescriptor — NOT the SLConfigDescriptor, which also carries bytes
 * and would be a wrong (unusable) config. WebCodecs needs exactly these bytes.
 */
const DECODER_SPECIFIC_INFO_TAG = 5;

function findAudioConfig(trak: unknown): Uint8Array | undefined {
  const entry = (
    trak as {
      mdia?: {
        minf?: { stbl?: { stsd?: { entries?: { esds?: unknown }[] } } };
      };
    }
  )?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const esd = (entry as { esds?: { esd?: { descs?: unknown[] } } })?.esds?.esd;
  if (!esd) return undefined;

  let config: Uint8Array | undefined;
  const walk = (d: unknown) => {
    const node = d as {
      tag?: number;
      data?: ArrayLike<number>;
      descs?: unknown[];
    };
    if (node?.tag === DECODER_SPECIFIC_INFO_TAG && node.data?.length) {
      config = new Uint8Array(node.data);
    }
    node?.descs?.forEach(walk);
  };
  esd.descs?.forEach(walk);
  return config;
}

/** Demux the first audio track of `url` into ordered encoded AAC chunks. */
export async function demuxAudioTrack(url: string): Promise<DemuxedAudio> {
  const file = createFile();
  const chunks: DemuxedAudio["chunks"] = [];
  let audioTrackId: number | undefined;
  let error: Error | null = null;

  file.onError = (_m, msg) => {
    error = new Error(`demux: ${msg}`);
  };
  // Extraction must be armed inside onReady, BEFORE parsing finishes: camera
  // files often place `moov` at the end, so if we waited until after the whole
  // buffer was parsed the samples would already be gone and none would extract.
  file.onReady = (info) => {
    const audioTrack = info.audioTracks[0];
    if (!audioTrack?.audio) return;
    audioTrackId = audioTrack.id;
    file.setExtractionOptions(audioTrack.id, null, {
      nbSamples: Number.MAX_SAFE_INTEGER,
    });
    file.start();
  };
  file.onSamples = (_id, _user, samples: Sample[]) => {
    for (const s of samples) {
      if (!s.data) continue;
      chunks.push({
        data: s.data,
        timestamp: (s.cts / s.timescale) * 1_000_000,
        duration: (s.duration / s.timescale) * 1_000_000,
      });
    }
    if (audioTrackId !== undefined) {
      file.releaseUsedSamples(audioTrackId, chunks.length);
    }
  };

  // The whole file is buffered in one shot; appendBuffer + flush parse it and
  // drive onReady/onSamples synchronously, so chunks are complete afterward.
  const buf = await (await fetch(url)).arrayBuffer();
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buf, 0));
  file.flush();

  if (error) throw error;
  const track: Track | undefined = file.getInfo().audioTracks[0];
  if (!track?.audio || audioTrackId === undefined) {
    throw new Error("no audio track");
  }

  return {
    codec: track.codec,
    sampleRate: track.audio.sample_rate,
    numberOfChannels: track.audio.channel_count,
    description: findAudioConfig(file.getTrackById(track.id)),
    chunks,
  };
}
