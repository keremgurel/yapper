"use client";

import { useCallback, useState } from "react";

export async function uploadThumbnailFile(
  file: File,
): Promise<{ key: string; previewUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  const mimeType = file.type || "image/png";
  const ext = mimeType.split("/")[1]?.split(";")[0] || "png";
  const presign = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sizeBytes: file.size,
      mimeType,
      ext,
      purpose: "thumbnail",
    }),
  });
  if (!presign.ok) throw new Error("failed");
  const { url, key } = (await presign.json()) as {
    url: string;
    key: string;
  };
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!put.ok) throw new Error("failed");
  return { key, previewUrl: URL.createObjectURL(file) };
}

/**
 * Upload a custom thumbnail/cover image to the user's R2 and hand back its key,
 * plus a local preview URL. Reuses the media presign flow (images are tiny). The
 * key is passed into a cross-post so YouTube (thumbnails.set) and Instagram
 * (cover_url) can use it; TikTok ignores it (frame-only covers).
 */
export function useThumbnailUpload(initial?: {
  key?: string;
  previewUrl?: string;
}) {
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(
    initial?.key ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial?.previewUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<"not_image" | "failed" | null>(null);

  const pick = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("not_image");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadThumbnailFile(file);
      setThumbnailKey(uploaded.key);
      setPreviewUrl(uploaded.previewUrl);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "not_image"
          ? "not_image"
          : "failed",
      );
    } finally {
      setUploading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setThumbnailKey(null);
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  return { thumbnailKey, previewUrl, uploading, error, pick, clear };
}
