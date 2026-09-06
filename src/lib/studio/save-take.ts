import { recordingExtension } from "./recording-file";

export type SaveTakeError =
  | "storage_full"
  | "locked"
  | "too_large"
  | "unavailable"
  | "failed";

async function uploadError(response: Response): Promise<never> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  throw new Error(
    data.error === "not_entitled"
      ? "locked"
      : data.error === "storage_full"
        ? "storage_full"
        : response.status === 413 || data.error === "clip_too_large"
          ? "too_large"
          : data.error === "storage_unavailable"
            ? "unavailable"
            : "failed",
  );
}

/** Retain completed upload/registration steps until this take is linked. */
export function createTakeSaver(options: {
  request?: typeof fetch;
  link: (itemId: string, submissionId: string) => Promise<void>;
}) {
  const request = options.request ?? fetch;
  let current:
    | {
        blob: Blob;
        itemId: string | null;
        savedItemId?: string;
        title?: string;
        upload?: { url: string; key: string };
        uploaded: boolean;
        submissionId?: string;
        linked: boolean;
      }
    | undefined;
  let running: Promise<string> | undefined;

  return (
    itemId: string | null,
    blob: Blob,
    title?: string,
  ): Promise<string> => {
    if (running) {
      if (current?.blob === blob && current.itemId === itemId) return running;
      return Promise.reject(new Error("save_in_progress"));
    }
    if (!current || current.blob !== blob || current.itemId !== itemId)
      current = { blob, itemId, title, uploaded: false, linked: false };
    const take = current;
    if (take.linked) return Promise.resolve(take.savedItemId!);
    const run = async () => {
      const mimeType = blob.type || "video/webm";
      if (!take.upload) {
        const presign = await request("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sizeBytes: blob.size,
            mimeType,
            ext: recordingExtension(mimeType),
            purpose: "recording",
          }),
        });
        if (!presign.ok) await uploadError(presign);
        const data = (await presign.json()) as { url?: string; key?: string };
        if (!data.url || !data.key) throw new Error("failed");
        take.upload = { url: data.url, key: data.key };
      }
      if (!take.uploaded) {
        const put = await request(take.upload.url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        if (!put.ok) {
          // An expired signature needs a fresh allocation. Transient failures
          // and lost PUT responses can retry the same object while valid.
          if (put.status === 401 || put.status === 403) take.upload = undefined;
          throw new Error("failed");
        }
        take.uploaded = true;
      }
      if (!take.submissionId) {
        const registered = await request("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaKey: take.upload.key,
            title: take.title,
            ...(take.itemId ? {} : { createLibraryItem: true }),
          }),
        });
        if (!registered.ok) {
          if (registered.status === 404) {
            // The pending upload can expire while a failed save waits.
            take.upload = undefined;
            take.uploaded = false;
          }
          await uploadError(registered);
        }
        const data = (await registered.json()) as {
          submission?: { id?: string; contentItemId?: string };
        };
        if (!data.submission?.id) throw new Error("failed");
        if (!take.itemId && !data.submission.contentItemId)
          throw new Error("failed");
        take.submissionId = data.submission.id;
        take.savedItemId = take.itemId ?? data.submission.contentItemId;
      }
      if (take.itemId) await options.link(take.itemId, take.submissionId);
      take.linked = true;
      return take.savedItemId!;
    };
    running = run().finally(() => {
      running = undefined;
    });
    return running;
  };
}
