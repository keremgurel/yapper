import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { MAX_CLIP_BYTES } from "@/lib/db/constants";
import {
  spoolBoundedTemporaryFile,
  type BoundedTemporaryFile,
} from "@/lib/http/bounded-temp-file";

// Cloudflare R2 (S3-compatible). Media (recordings) live here so /history can
// replay them; $0 egress makes replays free. Lazily constructed so importing
// this module never requires the env at build time.
let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("r2_not_configured");
    }
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

const bucket = () => process.env.R2_BUCKET ?? "yapper-media";

export const r2Configured = (): boolean =>
  !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );

/** Object key for a user's recording. Namespaced by user for cheap ownership
 * checks (a signed-in user can only touch keys under their own prefix). */
export function mediaKey(userId: string, submissionId: string, ext: string) {
  return `u/${userId}/${submissionId}.${ext}`;
}

export function ownsKey(userId: string, key: string): boolean {
  return key.startsWith(`u/${userId}/`);
}

/**
 * Object key for a take's audio on its way to the transcriber.
 *
 * Its own prefix under the user, because these are not recordings: they exist
 * for one request and are deleted as soon as the transcriber has read them, so
 * nothing here should be counted against a creator's storage or offered back
 * to them as media.
 */
export function transcriptionKey(userId: string, id: string): string {
  return `u/${userId}/asr/${id}.m4a`;
}

export function isTranscriptionKey(userId: string, key: string): boolean {
  return key.startsWith(`u/${userId}/asr/`) && key.endsWith(".m4a");
}

/** Presigned PUT for the client to upload a recording straight to R2. */
export function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 600,
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      // Bind the browser's automatic Content-Length header into SigV4. A
      // caller cannot claim one byte for quota purposes and then PUT a much
      // larger body through the same URL; R2 rejects the signature mismatch.
      ContentLength: contentLength,
    }),
    { expiresIn },
  );
}

/** Presigned GET for playback in the history view. */
export function presignView(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

/** Server-side read of an object's bytes (e.g. to forward a video to Gemini). */
export async function getObjectBytes(key: string): Promise<ArrayBuffer> {
  const res = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("r2_empty");
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export interface R2ObjectFile extends BoundedTemporaryFile {
  contentType: string;
}

/** Download an R2 object into an owned temporary file under a hard actual-byte
 * cap. Provider upload routes use this instead of retaining/copying the entire
 * object in serverless memory. */
export async function getObjectFile(
  key: string,
  options: { maxBytes?: number; signal?: AbortSignal } = {},
): Promise<R2ObjectFile> {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    options.signal ? { abortSignal: options.signal } : undefined,
  );
  const body = response.Body;
  if (!body || !(Symbol.asyncIterator in body)) throw new Error("r2_empty");
  const file = await spoolBoundedTemporaryFile(
    body as AsyncIterable<Uint8Array>,
    {
      maxBytes: options.maxBytes ?? MAX_CLIP_BYTES,
      declaredBytes: response.ContentLength,
      signal: options.signal,
      prefix: "yapper-r2-",
      fileName: "media.bin",
    },
  );
  return {
    ...file,
    contentType: response.ContentType?.split(";", 1)[0]?.trim() || "video/mp4",
  };
}

/** Server-side write of raw bytes to a key. Used to stash a video pulled from
 * another platform (e.g. an Instagram Reel) so the normal publish path, which
 * only posts from R2, can re-post it elsewhere. */
export async function putObjectBytes(
  key: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      ContentType: contentType,
    }),
  );
}

/** Upload a bounded temporary file without materializing it in application
 * memory. The caller supplies the verified byte length and owns file cleanup. */
export async function putObjectFile(
  key: string,
  filePath: string,
  bytes: number,
  contentType: string,
  signal?: AbortSignal,
): Promise<void> {
  const body = createReadStream(filePath);
  const abort = () => body.destroy(new DOMException("aborted", "AbortError"));
  signal?.addEventListener("abort", abort, { once: true });
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentLength: bytes,
        ContentType: contentType,
      }),
      signal ? { abortSignal: signal } : undefined,
    );
  } finally {
    signal?.removeEventListener("abort", abort);
    body.destroy();
  }
}

/**
 * Throw away a take's audio the moment the transcriber has read it.
 *
 * Physical deletion otherwise belongs to the leased lifecycle worker, because
 * a recording is referenced by submissions and history and a deletion that got
 * lost, or raced a live reference, would take something a creator still owns.
 * None of that applies here: this object is written for one request, is never
 * referenced by anything, and exists under a prefix that holds nothing else.
 * Keeping it would mean charging a creator storage for a copy of a video they
 * already have on their own disk.
 *
 * The prefix check is the safety rail. This can only ever delete scratch audio,
 * so it cannot become a back door to deleting media.
 */
export async function discardTranscriptionAudio(key: string): Promise<void> {
  if (!/^u\/[^/]+\/asr\/[^/]+\.m4a$/.test(key)) {
    throw new Error("not_transcription_audio");
  }
  await deleteObject(key);
}

export async function deleteObject(
  key: string,
  signal?: AbortSignal,
): Promise<void> {
  await s3().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
    signal ? { abortSignal: signal } : undefined,
  );
}

/** Actual size of an uploaded object, or null if it doesn't exist. Used to
 * verify a client-claimed upload before accounting for it (presigned PUTs
 * can't cap size, so the claimed byte count is only advisory). */
export async function headObjectBytes(key: string): Promise<number | null> {
  try {
    const res = await s3().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return res.ContentLength ?? 0;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey" || name === "404") {
      return null;
    }
    throw e;
  }
}
