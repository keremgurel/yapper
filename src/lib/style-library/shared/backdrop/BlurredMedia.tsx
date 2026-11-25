import { DESIGN_FRAME } from "../../runtime/design-frame";
import { useStyleMedia } from "../../runtime/style-runtime";

/**
 * A picture or clip filling the frame, blurred and darkened. The blur is a
 * plain `filter` on the media itself, never `backdrop-filter`, which headless
 * Chrome renders differently from frame to frame.
 */
export function BlurredMedia({
  kind,
  src,
  blur,
  dim,
}: {
  kind: "image" | "video";
  src: string;
  blur: number;
  dim: number;
}) {
  const { Video, Image } = useStyleMedia();
  const Media = kind === "video" ? Video : Image;
  // Drawn past the frame so the blur never pulls the edges in.
  const bleed = blur * 2;
  return (
    <Media
      src={src}
      muted
      style={{
        position: "absolute",
        left: -bleed,
        top: -bleed,
        width: DESIGN_FRAME.width + bleed * 2,
        height: DESIGN_FRAME.height + bleed * 2,
        objectFit: "cover",
        filter: `blur(${blur}px) brightness(${1 - dim}) saturate(0.9)`,
      }}
    />
  );
}
