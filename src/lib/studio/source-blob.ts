const sourceBlobs = new Map<string, Blob>();

/** Keep the original browser Blob behind its object URL. This adds only a
 * reference—the object URL already owns the same bytes—and lets upload paths
 * avoid refetching and rematerializing the complete recording. */
export function registerSourceBlob(url: string, blob: Blob): void {
  sourceBlobs.set(url, blob);
}

export function sourceBlobForUrl(url: string): Blob | undefined {
  return sourceBlobs.get(url);
}

export function releaseSourceBlob(url: string): void {
  sourceBlobs.delete(url);
}

/** Revoke both forms of browser ownership together. */
export function revokeStudioObjectUrl(url: string): void {
  releaseSourceBlob(url);
  URL.revokeObjectURL(url);
}
