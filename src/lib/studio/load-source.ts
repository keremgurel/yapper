import type { StudioSource } from "@/lib/studio/types";
import {
  registerSourceBlob,
  revokeStudioObjectUrl,
} from "@/lib/studio/source-blob";

/**
 * Create a StudioSource from a video Blob/File, probing duration robustly.
 * MediaRecorder webm blobs often report `duration: Infinity` until the element
 * is seeked, so we force a duration computation when needed.
 */
export function loadVideoSource(
  file: Blob,
  name: string,
): Promise<StudioSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    registerSourceBlob(url, file);
    const v = document.createElement("video");
    v.preload = "metadata";

    const finish = (duration: number) =>
      resolve({
        url,
        name,
        duration: duration > 0 ? duration : 0,
        width: v.videoWidth || undefined,
        height: v.videoHeight || undefined,
      });

    v.onloadedmetadata = () => {
      if (v.duration === Infinity || Number.isNaN(v.duration)) {
        v.currentTime = 1e101; // seek far to force the browser to compute duration
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          const d = Number.isFinite(v.duration) ? v.duration : 0;
          v.currentTime = 0;
          finish(d);
        };
      } else {
        finish(v.duration);
      }
    };
    v.onerror = () => {
      revokeStudioObjectUrl(url);
      reject(new Error("Could not read that video file."));
    };
    v.src = url;
  });
}
