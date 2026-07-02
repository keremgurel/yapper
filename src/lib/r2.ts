import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

/** Presigned PUT for the client to upload a recording straight to R2. */
export function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
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

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
