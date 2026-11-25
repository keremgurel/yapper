/**
 * True when a source that a block asked to play is really a picture: a drawn
 * stand-in, or an image a creator put where a clip could go. A host draws it
 * as an image instead of handing it to a video element.
 */
export const isStillSource = (src: string): boolean =>
  /^data:image\//i.test(src) ||
  /\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i.test(src);
