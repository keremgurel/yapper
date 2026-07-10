import { loadVideoSource } from "@/lib/studio/load-source";
import {
  newMediaId,
  type MediaAsset,
  type StudioSource,
} from "@/lib/studio/types";

/** How long a still shows for when it lands on a track. */
const IMAGE_SECONDS = 5;

/** Natural size of an image, or nothing if it will not decode. */
function imageSize(url: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
      });
    img.onerror = () => resolve({});
    img.src = url;
  });
}

/**
 * Turn an uploaded file into a library asset, or null when it is neither a
 * video nor an image. The returned asset owns an object URL: whoever drops it
 * from the library decides when (and whether) to revoke it.
 */
export async function assetFromFile(file: File): Promise<MediaAsset | null> {
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    return {
      id: newMediaId(),
      kind: "image",
      url,
      name: file.name,
      duration: IMAGE_SECONDS,
      ...(await imageSize(url)),
    };
  }
  if (file.type.startsWith("video/")) {
    const media = await loadVideoSource(file, file.name);
    return {
      id: newMediaId(),
      kind: "video",
      url: media.url,
      name: media.name,
      duration: media.duration,
      width: media.width,
      height: media.height,
    };
  }
  return null;
}

/** The project's recording, as an ordinary library asset like any other. */
export function assetFromSource(source: StudioSource): MediaAsset {
  return {
    id: newMediaId(),
    kind: source.kind === "image" ? "image" : "video",
    url: source.url,
    name: source.name,
    duration: source.duration,
    width: source.width,
    height: source.height,
  };
}
