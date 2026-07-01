/**
 * In-browser speech-to-text using transformers.js Whisper, loaded at RUNTIME
 * from a CDN so the bundler never touches the heavy ML/WASM code (keeps every
 * other route light and the build green). Fully keyless and on-device.
 */

export interface RawWord {
  text: string;
  start: number;
  end: number;
}

export type TranscribeProgress = {
  status: "loading" | "transcribing";
  progress?: number; // 0-100 during model download
};

interface TransformersEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
}

interface AsrChunk {
  text: string;
  timestamp: [number | null, number | null];
}
interface AsrResult {
  text?: string;
  chunks?: AsrChunk[];
}
type AsrPipeline = (
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<AsrResult>;

interface TransformersModule {
  env: TransformersEnv;
  pipeline: (
    task: string,
    model: string,
    opts: Record<string, unknown>,
  ) => Promise<AsrPipeline>;
}

const TF_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
// base.en is markedly more accurate than tiny for text and word timing, while
// staying small enough to download and run on-device.
const MODEL = "Xenova/whisper-base.en";

let modulePromise: Promise<TransformersModule> | null = null;
let pipelinePromise: Promise<AsrPipeline> | null = null;

function loadModule(): Promise<TransformersModule> {
  if (!modulePromise) {
    // Hide the import from the bundler entirely; resolve it natively at runtime.
    const dynamicImport = new Function("u", "return import(u)") as (
      u: string,
    ) => Promise<TransformersModule>;
    modulePromise = dynamicImport(TF_URL);
  }
  return modulePromise;
}

function getPipeline(
  onProgress?: (p: TranscribeProgress) => void,
): Promise<AsrPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const mod = await loadModule();
      mod.env.allowLocalModels = false;
      mod.env.allowRemoteModels = true;
      return mod.pipeline("automatic-speech-recognition", MODEL, {
        progress_callback: (e: { status?: string; progress?: number }) => {
          if (e.status === "progress") {
            onProgress?.({ status: "loading", progress: e.progress });
          }
        },
      });
    })();
  }
  return pipelinePromise;
}

function toWords(result: AsrResult): RawWord[] {
  const chunks = result.chunks ?? [];
  return chunks
    .filter((c) => c.timestamp && c.timestamp[0] != null && c.text.trim())
    .map((c) => ({
      text: c.text.trim(),
      start: c.timestamp[0] as number,
      end: (c.timestamp[1] ?? c.timestamp[0]) as number,
    }));
}

export async function transcribeAudio(
  audio: Float32Array,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<RawWord[]> {
  const transcriber = await getPipeline(onProgress);
  onProgress?.({ status: "transcribing" });

  // Prefer word-level timestamps; fall back to segment-level if unavailable.
  try {
    const wordLevel = await transcriber(audio, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const words = toWords(wordLevel);
    if (words.length > 0) return words;
  } catch {
    // fall through to segment-level
  }

  const segmentLevel = await transcriber(audio, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return toWords(segmentLevel);
}
