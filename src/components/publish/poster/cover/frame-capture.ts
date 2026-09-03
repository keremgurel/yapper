/**
 * Pixels in, data URLs out. Nothing here touches React or the network.
 */
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

/** Wait until the browser has actually presented the frame at the seek target.
 * `seeked` fires when the seek completes, but on some engines the previously
 * painted frame is still what `drawImage` sees for one more tick. */
export function seekVideo(
  video: HTMLVideoElement,
  time: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const settle = () => {
      cleanup();
      if ("requestVideoFrameCallback" in video) {
        (
          video as HTMLVideoElement & {
            requestVideoFrameCallback: (cb: () => void) => number;
          }
        ).requestVideoFrameCallback(() => resolve());
        // A paused video may never present a new frame; do not hang on it.
        setTimeout(resolve, 120);
      } else {
        requestAnimationFrame(() => resolve());
      }
    };
    const fail = () => {
      cleanup();
      reject(new Error("frame_seek"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", settle);
      video.removeEventListener("error", fail);
    };
    if (!video.seeking && Math.abs(video.currentTime - time) < 0.002) {
      resolve();
      return;
    }
    video.addEventListener("seeked", settle, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.currentTime = time;
  });
}

/** The current frame as a 1080×1920 JPEG, centre cropped to 9:16. */
export function captureFrame(source: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("frame_canvas");
  const sourceRatio = source.videoWidth / source.videoHeight;
  const targetRatio = FRAME_WIDTH / FRAME_HEIGHT;
  let sx = 0;
  let sy = 0;
  let sw = source.videoWidth;
  let sh = source.videoHeight;
  if (sourceRatio > targetRatio) {
    sw = source.videoHeight * targetRatio;
    sx = (source.videoWidth - sw) / 2;
  } else {
    sh = source.videoWidth / targetRatio;
    sy = (source.videoHeight - sh) / 2;
  }
  context.drawImage(source, sx, sy, sw, sh, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** A small filmstrip tile of the current frame. */
export function captureTile(source: HTMLVideoElement, height: number): string {
  const canvas = document.createElement("canvas");
  const ratio = source.videoWidth / source.videoHeight || 9 / 16;
  canvas.height = height;
  canvas.width = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("frame_canvas");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** An uploaded or pasted image, downscaled so the request stays small. */
export async function imageFileData(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("not_image"));
      element.src = source;
    });
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_canvas");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(source);
  }
}
