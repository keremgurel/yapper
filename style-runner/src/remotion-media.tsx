import { Img, OffthreadVideo, staticFile } from "remotion";
import { isStillSource } from "../../src/lib/style-library/runtime/still-source";
import type { StyleMedia } from "../../src/lib/style-library/runtime/style-runtime";

/** A bare path is a file in the runner's public folder; anything else is used as given. */
const resolve = (src: string) =>
  /^(https?:|data:|blob:|\/)/.test(src) ? src : staticFile(src);

/** The library's media elements, drawn by Remotion so every frame is exact. */
export const remotionMedia: StyleMedia = {
  Video: ({ src, style, muted }) =>
    isStillSource(src) ? (
      <Img src={resolve(src)} style={style} />
    ) : (
      <OffthreadVideo src={resolve(src)} style={style} muted={muted} />
    ),
  Image: ({ src, style, alt = "" }) => (
    <Img src={resolve(src)} style={style} alt={alt} />
  ),
};
