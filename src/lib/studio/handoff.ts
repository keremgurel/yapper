/**
 * In-memory handoff for sending a just-recorded take from the practice flow to
 * /studio. Client-side navigation preserves module state, so we don't need a
 * store or query param. Cleared on consume.
 */
let pending: Blob | null = null;

export function setPendingVideo(blob: Blob): void {
  pending = blob;
}

export function consumePendingVideo(): Blob | null {
  const blob = pending;
  pending = null;
  return blob;
}
